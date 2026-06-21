/**
 * HermesTalk — 위임(delegate_task) 런 이벤트 파서 (Phase 4 do, 모델 무관 핵심)
 *
 * `/v1/runs/{id}/events` SSE를 그룹방 "위임 타임라인"으로 정규화한다.
 *
 * 실제 이벤트 어휘(✅ 라이브 캡처로 확정, run_37f6...):
 *   - lifecycle: {event:"run.created"|"run.in_progress"|"run.completed"|"run.failed", error?}
 *       run.completed.output = 리더 최종 텍스트(전체), usage 포함.
 *   - 텍스트:    {event:"message.delta", delta:"..."}  (리더 스트리밍)
 *   - 추론:      {event:"reasoning.available", text} (타임라인엔 미사용)
 *   - 툴:        {event:"tool.started", tool:"delegate_task", preview?}
 *                {event:"tool.completed", tool:"delegate_task", duration, error}
 *   - ⚠️ 실제 tool 이벤트는 필드명이 **`tool`**(name 아님)이고 **input/output 없음**.
 *     위임 내용·결과는 tool 이벤트가 아니라 리더의 message.delta / run.completed.output로 온다.
 *     → 위임 항목은 "발생/완료(+duration) 마커"이고, 결과 텍스트는 assistantText에 누적.
 *
 * (PHASE0 문서의 OpenAI Responses 스타일 + jobs-api의 name/input/output은 폴백으로 유지.)
 *
 * 순수 함수 — 라이브 모델 없이 합성/실측 이벤트로 단위 검증 가능.
 */

export type RunLifecycle = 'created' | 'in_progress' | 'completed' | 'failed'

export type DelegationEntry = {
  kind: 'delegation'
  callId: string
  /** 위임 목표/지시(인자/preview에서 추출, 실제 tool 이벤트엔 없을 수 있음) */
  goal: string | null
  /** 지목된 워커/역할(있으면) */
  target: string | null
  rawArguments: string
  status: 'started' | 'done'
  /** 위임 결과(폴백 어휘에만 존재. 실제는 리더 assistantText로 옴) */
  result: string | null
  /** tool.completed의 소요시간(초) */
  durationSec: number | null
}

export type DelegationTimeline = {
  status: RunLifecycle
  error: string | null
  /** 리더의 누적 텍스트(취합/요약) */
  assistantText: string
  /** 위임 항목들 */
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
    return parsed && typeof parsed === 'object' ? (parsed as RunEvent) : null
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

const DELEGATE_TOOL = 'delegate_task'

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

function startDelegation(
  state: DelegationTimeline,
  rawArguments: string,
  preview: string | null,
): DelegationTimeline {
  const { goal, target } = extractGoalTarget(rawArguments)
  const entry: DelegationEntry = {
    kind: 'delegation',
    callId: `d${state.delegations.length}`,
    goal: goal ?? preview,
    target,
    rawArguments,
    status: 'started',
    result: null,
    durationSec: null,
  }
  return { ...state, delegations: [...state.delegations, entry] }
}

function completeDelegation(
  state: DelegationTimeline,
  rawArguments: string,
  output: string | null,
  durationSec: number | null,
): DelegationTimeline {
  // call_id 없는 어휘 → 같은 인자의 미완 항목, 없으면 가장 오래된 미완 항목에 매칭(FIFO)
  const byArgs = state.delegations.findIndex(
    (d) => d.status === 'started' && d.rawArguments === rawArguments,
  )
  const idx =
    byArgs >= 0
      ? byArgs
      : state.delegations.findIndex((d) => d.status === 'started')
  if (idx < 0) {
    const { goal, target } = extractGoalTarget(rawArguments)
    return {
      ...state,
      delegations: [
        ...state.delegations,
        {
          kind: 'delegation',
          callId: `d${state.delegations.length}`,
          goal,
          target,
          rawArguments,
          status: 'done',
          result: output,
          durationSec,
        },
      ],
    }
  }
  return {
    ...state,
    delegations: state.delegations.map((d, i) =>
      i === idx
        ? {
            ...d,
            status: 'done' as const,
            result: output ?? d.result,
            durationSec: durationSec ?? d.durationSec,
          }
        : d,
    ),
  }
}

function isDelegateTool(event: RunEvent): boolean {
  return (
    asString(event.tool) === DELEGATE_TOOL ||
    asString(event.name) === DELEGATE_TOOL
  )
}

function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** 단일 이벤트를 타임라인에 누적(불변 갱신). */
export function reduceRunEvent(
  state: DelegationTimeline,
  event: RunEvent,
): DelegationTimeline {
  // ── 1차: event-field 어휘(실제 게이트웨이) ──────────────────────────
  const ev = asString(event.event)
  if (ev) {
    switch (ev) {
      case 'run.created':
      case 'run.queued':
        return { ...state, status: 'created' }
      case 'run.in_progress':
      case 'run.running':
        return { ...state, status: 'in_progress' }
      case 'run.completed': {
        // run.completed.output = 리더 최종 텍스트(전체). delta 누적이 비었으면 사용.
        const output = asString(event.output)
        return {
          ...state,
          status: 'completed',
          assistantText:
            state.assistantText.length > 0
              ? state.assistantText
              : (output ?? ''),
        }
      }
      case 'run.failed':
        return { ...state, status: 'failed', error: asString(event.error) }
      case 'message.delta':
        return {
          ...state,
          assistantText: state.assistantText + (asString(event.delta) ?? ''),
        }
      case 'tool.started':
        if (isDelegateTool(event)) {
          // 실제 tool 이벤트엔 input 없음 → preview/없음. 폴백 어휘는 input 사용.
          return startDelegation(
            state,
            asString(event.input) ?? '{}',
            asString(event.preview),
          )
        }
        return state
      case 'tool.completed':
        if (isDelegateTool(event)) {
          return completeDelegation(
            state,
            asString(event.input) ?? '{}',
            asString(event.output),
            asNumber(event.duration),
          )
        }
        return state
      default:
        return state
    }
  }

  // ── 2차(폴백): OpenAI Responses 스타일(type-field) ──────────────────
  const type = asString(event.type)
  if (!type) return state
  if (type === 'response.output_text.delta') {
    return {
      ...state,
      assistantText: state.assistantText + (asString(event.delta) ?? ''),
    }
  }
  if (
    type === 'response.output_item.added' ||
    type === 'response.output_item.done'
  ) {
    const item = (event.item ?? {}) as Record<string, unknown>
    if (item.type !== 'function_call' || item.name !== DELEGATE_TOOL) {
      return state
    }
    const rawArguments = asString(item.arguments) ?? '{}'
    if (type === 'response.output_item.added') {
      return startDelegation(state, rawArguments, null)
    }
    return completeDelegation(state, rawArguments, null, null)
  }
  return state
}

/** 이벤트 배열을 타임라인으로 폴드. */
export function reduceRunEvents(events: RunEvent[]): DelegationTimeline {
  return events.reduce(reduceRunEvent, emptyTimeline())
}
