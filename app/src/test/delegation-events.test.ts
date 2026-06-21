import { describe, expect, it } from 'vitest'
import {
  parseSseBlock,
  parseSseData,
  reduceRunEvents,
} from '../screens/chat/delegation-events'

describe('parseSseData', () => {
  it('parses a data: line', () => {
    expect(parseSseData('data: {"event":"run.created"}')).toEqual({
      event: 'run.created',
    })
  })
  it('ignores [DONE], comments, non-data, bad json', () => {
    expect(parseSseData('data: [DONE]')).toBeNull()
    expect(parseSseData(': stream closed')).toBeNull()
    expect(parseSseData('event: foo')).toBeNull()
    expect(parseSseData('data: not-json')).toBeNull()
  })
})

describe('reduceRunEvents — real captured run.failed', () => {
  it('captures failed status + error (Codex token)', () => {
    const block = `data: {"event": "run.failed", "run_id": "run_b56d143396574113aad7e8d6861d8e34", "timestamp": 1782031582.382622, "error": "Codex refresh token was already consumed by another client (e.g. Codex CLI or VS Code extension)."}\n\n: stream closed\n`
    const timeline = reduceRunEvents(parseSseBlock(block))
    expect(timeline.status).toBe('failed')
    expect(timeline.error).toContain('Codex refresh token')
    expect(timeline.delegations).toHaveLength(0)
  })
})

describe('reduceRunEvents — real event-field vocabulary (jobs-api RunEvent)', () => {
  it('tool.started/completed(delegate_task) + message.delta → 타임라인', () => {
    // 실제 게이트웨이 어휘: {event, name, input, output, delta}
    const events = [
      { event: 'run.created', run_id: 'r1', timestamp: 1 },
      { event: 'run.in_progress', run_id: 'r1', timestamp: 2 },
      {
        event: 'tool.started',
        run_id: 'r1',
        timestamp: 3,
        name: 'delegate_task',
        input: '{"goal":"say hello in French","assignee":"fr-worker"}',
      },
      {
        event: 'tool.started',
        run_id: 'r1',
        timestamp: 4,
        name: 'delegate_task',
        input: '{"goal":"say hello in Korean","role":"ko-worker"}',
      },
      // 비-delegate 툴은 무시
      { event: 'tool.started', run_id: 'r1', timestamp: 5, name: 'web_search', input: '{}' },
      {
        event: 'tool.completed',
        run_id: 'r1',
        timestamp: 6,
        name: 'delegate_task',
        input: '{"goal":"say hello in French","assignee":"fr-worker"}',
        output: 'Bonjour',
      },
      {
        event: 'tool.completed',
        run_id: 'r1',
        timestamp: 7,
        name: 'delegate_task',
        input: '{"goal":"say hello in Korean","role":"ko-worker"}',
        output: '안녕하세요',
      },
      { event: 'message.delta', run_id: 'r1', timestamp: 8, delta: 'Both ' },
      { event: 'message.delta', run_id: 'r1', timestamp: 9, delta: 'done.' },
      { event: 'run.completed', run_id: 'r1', timestamp: 10 },
    ]
    const t = reduceRunEvents(events)

    expect(t.status).toBe('completed')
    expect(t.error).toBeNull()
    expect(t.assistantText).toBe('Both done.')
    expect(t.delegations).toHaveLength(2)

    const fr = t.delegations.find((d) => d.goal === 'say hello in French')!
    expect(fr.target).toBe('fr-worker')
    expect(fr.result).toBe('Bonjour')
    expect(fr.status).toBe('done')

    const ko = t.delegations.find((d) => d.goal === 'say hello in Korean')!
    expect(ko.target).toBe('ko-worker')
    expect(ko.result).toBe('안녕하세요')
    expect(ko.status).toBe('done')
  })

  it('completed without started still records result', () => {
    const t = reduceRunEvents([
      { event: 'tool.completed', name: 'delegate_task', input: '{"goal":"g"}', output: 'R' },
    ])
    expect(t.delegations).toHaveLength(1)
    expect(t.delegations[0].status).toBe('done')
    expect(t.delegations[0].result).toBe('R')
  })
})

describe('reduceRunEvents — Responses-style fallback', () => {
  it('handles response.output_item + output_text.delta', () => {
    const t = reduceRunEvents([
      {
        type: 'response.output_item.added',
        item: { type: 'function_call', name: 'delegate_task', arguments: '{"goal":"g"}' },
      },
      { type: 'response.output_text.delta', delta: 'hi' },
    ])
    expect(t.delegations).toHaveLength(1)
    expect(t.delegations[0].goal).toBe('g')
    expect(t.assistantText).toBe('hi')
  })
})
