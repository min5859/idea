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
  it('ignores [DONE], comments, non-data', () => {
    expect(parseSseData('data: [DONE]')).toBeNull()
    expect(parseSseData(': stream closed')).toBeNull()
    expect(parseSseData('event: foo')).toBeNull()
    expect(parseSseData('data: not-json')).toBeNull()
  })
})

describe('reduceRunEvents — real captured run.failed', () => {
  it('captures failed status + error (Codex token)', () => {
    // 실제 캡처(scratchpad/run-events.txt)
    const block = `data: {"event": "run.failed", "run_id": "run_b56d143396574113aad7e8d6861d8e34", "timestamp": 1782031582.382622, "error": "Codex refresh token was already consumed by another client (e.g. Codex CLI or VS Code extension)."}\n\n: stream closed\n`
    const timeline = reduceRunEvents(parseSseBlock(block))
    expect(timeline.status).toBe('failed')
    expect(timeline.error).toContain('Codex refresh token')
    expect(timeline.delegations).toHaveLength(0)
  })
})

describe('reduceRunEvents — synthetic delegate_task flow', () => {
  it('builds a delegation timeline: 2 위임 + 결과 + 취합', () => {
    const events = [
      { event: 'run.created' },
      { event: 'run.in_progress' },
      {
        type: 'response.output_item.added',
        item: {
          type: 'function_call',
          name: 'delegate_task',
          call_id: 'c1',
          arguments: '{"goal":"say hello in French","assignee":"fr-worker"}',
        },
      },
      {
        type: 'response.output_item.added',
        item: {
          type: 'function_call',
          name: 'delegate_task',
          call_id: 'c2',
          arguments: '{"goal":"say hello in Korean","role":"ko-worker"}',
        },
      },
      // 다른 툴콜은 무시되어야 함
      {
        type: 'response.output_item.added',
        item: { type: 'function_call', name: 'web_search', call_id: 'x', arguments: '{}' },
      },
      {
        type: 'response.function_call_output',
        item: { call_id: 'c1', output: 'Bonjour' },
      },
      {
        type: 'response.output_item.done',
        item: {
          type: 'function_call',
          name: 'delegate_task',
          call_id: 'c2',
          arguments: '{"goal":"say hello in Korean","role":"ko-worker"}',
        },
      },
      { type: 'response.function_call_output', item: { call_id: 'c2', output: '안녕하세요' } },
      { type: 'response.output_text.delta', delta: 'Both ' },
      { type: 'response.output_text.delta', delta: 'done.' },
      { event: 'run.completed' },
    ]
    const t = reduceRunEvents(events)

    expect(t.status).toBe('completed')
    expect(t.error).toBeNull()
    expect(t.assistantText).toBe('Both done.')

    // delegate_task 2개만 (web_search 제외), call_id dedupe
    expect(t.delegations).toHaveLength(2)

    const c1 = t.delegations.find((d) => d.callId === 'c1')!
    expect(c1.goal).toBe('say hello in French')
    expect(c1.target).toBe('fr-worker')
    expect(c1.result).toBe('Bonjour')
    expect(c1.status).toBe('done')

    const c2 = t.delegations.find((d) => d.callId === 'c2')!
    expect(c2.goal).toBe('say hello in Korean')
    expect(c2.target).toBe('ko-worker')
    expect(c2.result).toBe('안녕하세요')
    expect(c2.status).toBe('done')
  })

  it('added 후 done 갱신 시 중복 생성하지 않는다', () => {
    const events = [
      {
        type: 'response.output_item.added',
        item: { type: 'function_call', name: 'delegate_task', call_id: 'c1', arguments: '{"goal":"g"}' },
      },
      {
        type: 'response.output_item.done',
        item: { type: 'function_call', name: 'delegate_task', call_id: 'c1', arguments: '{"goal":"g"}' },
      },
    ]
    const t = reduceRunEvents(events)
    expect(t.delegations).toHaveLength(1)
    expect(t.delegations[0].status).toBe('done')
  })
})
