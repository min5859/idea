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

describe('reduceRunEvents — REAL captured shape (run_37f6, tool 필드)', () => {
  it('tool.started/completed(tool 필드) + message.delta + run.completed.output', () => {
    // ✅ 실제 캡처: tool 이벤트는 필드명 `tool`, input/output 없음, duration/preview만.
    //    위임 결과 텍스트는 message.delta / run.completed.output로 옴.
    const events = [
      { event: 'tool.started', run_id: 'r', timestamp: 1, tool: 'delegate_task', preview: null },
      {
        event: 'tool.completed',
        run_id: 'r',
        timestamp: 2,
        tool: 'delegate_task',
        duration: 3.994,
        error: false,
      },
      { event: 'message.delta', run_id: 'r', timestamp: 3, delta: '“Hello”는 ' },
      { event: 'message.delta', run_id: 'r', timestamp: 4, delta: 'Bonjour, 안녕하세요.' },
      { event: 'reasoning.available', run_id: 'r', timestamp: 5, text: '...' },
      {
        event: 'run.completed',
        run_id: 'r',
        timestamp: 6,
        output: '“Hello”는 French로 “Bonjour”, Korean으로 “안녕하세요”입니다.',
        usage: { input_tokens: 27440, output_tokens: 147, total_tokens: 27587 },
      },
    ]
    const t = reduceRunEvents(events)

    expect(t.status).toBe('completed')
    expect(t.delegations).toHaveLength(1)
    expect(t.delegations[0].status).toBe('done')
    expect(t.delegations[0].durationSec).toBe(3.994)
    // message.delta 누적이 있으면 그걸 우선
    expect(t.assistantText).toBe('“Hello”는 Bonjour, 안녕하세요.')
  })

  it('run.completed.output을 delta 없을 때 assistantText로 사용', () => {
    const t = reduceRunEvents([
      { event: 'tool.started', tool: 'delegate_task' },
      { event: 'tool.completed', tool: 'delegate_task', duration: 1 },
      { event: 'run.completed', output: 'final only' },
    ])
    expect(t.assistantText).toBe('final only')
    expect(t.delegations[0].durationSec).toBe(1)
  })

  it('비-delegate tool은 무시', () => {
    const t = reduceRunEvents([
      { event: 'tool.started', tool: 'web_search' },
      { event: 'tool.completed', tool: 'web_search' },
    ])
    expect(t.delegations).toHaveLength(0)
  })

  it('폴백: name/input/output 어휘(jobs-api 타입)도 처리', () => {
    const t = reduceRunEvents([
      { event: 'tool.started', name: 'delegate_task', input: '{"goal":"g","assignee":"w"}' },
      { event: 'tool.completed', name: 'delegate_task', input: '{"goal":"g","assignee":"w"}', output: 'R' },
    ])
    expect(t.delegations).toHaveLength(1)
    expect(t.delegations[0].goal).toBe('g')
    expect(t.delegations[0].target).toBe('w')
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
