/**
 * HermesTalk — 위임(delegate_task) 런 이벤트 파서 (Phase 4 do, 모델 무관 핵심)
 *
 * `/v1/runs/{id}/events` SSE를 그룹방 "위임 타임라인"으로 정규화한다. Hermes는
 * OpenAI Responses 스타일 + lifecycle은 `{"event": "..."}` 필드로 낸다(실측: run.failed).
 *   - lifecycle: {"event":"run.created"|"run.completed"|"run.failed", error?}
 *   - 토큰:      {"type":"response.output_text.delta", "delta":"..."}
 *   - 툴콜:      {"type":"response.output_item.added"|"done", "item":{type:"function_call", name, arguments, ...}}
 *   - 결과:      {"type":"response.function_call_output", ...} 또는 item.type=="function_call_output"
 *   - 위임은 별도 이벤트가 아니라 name=="delegate_task" 인 function_call. (PHASE0-VERIFICATION §4)
 *
 * 순수 함수로 분리 — 라이브 모델 없이 합성/실측 이벤트로 단위 검증 가능.
 * (라이브 delegate_task 캡처로 필드 미세조정 여지. 본 모듈만 isolated.)
 */

export type RunLifecycle = 'created' | 'in_progress' | 'completed' | 'failed'

export type DelegationEntry = {
  kind: 'delegation'
  callId: string
  /** delegate_task arguments에서 추출한 위임 목표/지시 */
  goal: string | null
  /** 지목된 워커/역할(있으면) */
  target: string | null
  rawArguments: string
  status: 'started' | 'done'
  /** function_call_output로 도착한 결과(취합) */
  result: string | null
}

export type DelegationTimeline = {
  status: RunLifecycle
  error: string | null
  /** 리더의 누적 텍스트(취합/요약) */
  assistantText: string
  /** 위임 항목들(call_id 기준 dedupe) */
  delegations: DelegationEntry[]
}

export type RunEvent = Record<string, unknown>

/** `data: {...}` SSE 한 줄을 파싱. data가 아니거나 [DONE]/주석이면 null. */
export function parseSseData(line: string): RunEvent | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data:')) return null
  const payload = trimmed.slice('data:'.length).trim()
  if (!payload || payload === '[DONE]') return null
  try {
    const parsed = JSON.parse(payload) as unknown
    return parsed && typeof parsed === 'object'
      ? (parsed as RunEvent)
      : null
  } catch {
    return null
  }
}

/** SSE 텍스트 블록(여러 줄)에서 이벤트 객체들을 뽑아낸다. */
export function parseSseBlock(text: string): RunEvent[] {
  const out: RunEvent[] = []
  for (const line of text.split('\n')) {
    const ev = parseSseData(line)
    if (ev) out.push(ev)
  }
  return out
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

function extractGoalTarget(rawArguments: string): {
  goal: string | null
  target: string | null
} {
  try {
    const args = JSON.parse(rawArguments) as Record<string, unknown>
    const goal =
      asString(args.goal) ??
      asString(args.task) ??
      asString(args.prompt) ??
      asString(args.instruction) ??
      asString(args.title)
    const target =
      asString(args.assignee) ??
      asString(args.agent) ??
      asString(args.target) ??
      asString(args.role) ??
      asString(args.profile)
    return { goal, target }
  } catch {
    return { goal: null, target: null }
  }
}

function emptyTimeline(): DelegationTimeline {
  return { status: 'created', error: null, assistantText: '', delegations: [] }
}

function isFunctionCallItem(item: Record<string, unknown>): boolean {
  return item.type === 'function_call' && item.name === 'delegate_task'
}

/** 단일 이벤트를 타임라인에 누적(불변 갱신). */
export function reduceRunEvent(
  state: DelegationTimeline,
  event: RunEvent,
): DelegationTimeline {
  // 1) lifecycle (event 필드)
  const lifecycle = asString(event.event)
  if (lifecycle) {
    if (lifecycle === 'run.created' || lifecycle === 'run.queued') {
      return { ...state, status: 'created' }
    }
    if (lifecycle === 'run.in_progress' || lifecycle === 'run.running') {
      return { ...state, status: 'in_progress' }
    }
    if (lifecycle === 'run.completed') {
      return { ...state, status: 'completed' }
    }
    if (lifecycle === 'run.failed') {
      return { ...state, status: 'failed', error: asString(event.error) }
    }
    return state
  }

  const type = asString(event.type)
  if (!type) return state

  // 2) 리더 텍스트 델타
  if (type === 'response.output_text.delta') {
    const delta = asString(event.delta) ?? ''
    return { ...state, assistantText: state.assistantText + delta }
  }

  // 3) function_call 아이템 added/done → 위임
  if (
    type === 'response.output_item.added' ||
    type === 'response.output_item.done'
  ) {
    const item = (event.item ?? {}) as Record<string, unknown>
    if (!isFunctionCallItem(item)) return state
    const callId =
      asString(item.call_id) ?? asString(item.id) ?? `call-${state.delegations.length}`
    const rawArguments = asString(item.arguments) ?? '{}'
    const { goal, target } = extractGoalTarget(rawArguments)
    const status = type === 'response.output_item.done' ? 'done' : 'started'

    const existingIdx = state.delegations.findIndex((d) => d.callId === callId)
    const entry: DelegationEntry = {
      kind: 'delegation',
      callId,
      goal,
      target,
      rawArguments,
      status,
      result:
        existingIdx >= 0 ? state.delegations[existingIdx].result : null,
    }
    const delegations =
      existingIdx >= 0
        ? state.delegations.map((d, i) => (i === existingIdx ? entry : d))
        : [...state.delegations, entry]
    return { ...state, delegations }
  }

  // 4) function_call_output → 위임 결과(취합)
  if (
    type === 'response.function_call_output' ||
    (event.item as Record<string, unknown> | undefined)?.type ===
      'function_call_output'
  ) {
    const item = (event.item ?? event) as Record<string, unknown>
    const callId = asString(item.call_id) ?? asString(item.id)
    const output =
      asString(item.output) ?? asString(item.result) ?? asString(event.output)
    if (!callId) return state
    const delegations = state.delegations.map((d) =>
      d.callId === callId ? { ...d, result: output, status: 'done' as const } : d,
    )
    return { ...state, delegations }
  }

  return state
}

/** 이벤트 배열을 타임라인으로 폴드. */
export function reduceRunEvents(events: RunEvent[]): DelegationTimeline {
  return events.reduce(reduceRunEvent, emptyTimeline())
}
