'use client'

import { useCallback, useRef, useState } from 'react'
import { startRun } from '@/lib/jobs-api'
import {
  reduceRunEvent,
  type DelegationTimeline,
  type RunEvent,
} from '../delegation-events'

/**
 * HermesTalk — 그룹방 위임 런 구독 훅 (Phase 4 do)
 *
 * `/api/hermes-runs`로 run을 시작(POST 프록시, 실측: {run_id} 반환)하고
 * `/api/hermes-runs/{id}/events`(SSE)를 구독해 delegation-events 파서로 위임
 * 타임라인을 누적한다. (jobs-screen의 EventSource 패턴과 동일.)
 *
 * 라이브 content(실제 delegate_task 흐름)는 모델 재인증 후 검증.
 */

const EMPTY: DelegationTimeline = {
  status: 'created',
  error: null,
  assistantText: '',
  delegations: [],
}

export function useRunDelegation() {
  const [timeline, setTimeline] = useState<DelegationTimeline>(EMPTY)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)

  const stop = useCallback(() => {
    esRef.current?.close()
    esRef.current = null
    setRunning(false)
  }, [])

  const start = useCallback(
    async (input: string) => {
      const trimmed = input.trim()
      if (!trimmed) return
      // 직전 구독 정리
      esRef.current?.close()
      esRef.current = null
      setTimeline(EMPTY)
      setError(null)
      setRunning(true)

      let runId: string
      try {
        runId = await startRun(trimmed)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to start run')
        setRunning(false)
        return
      }

      const es = new EventSource(`/api/hermes-runs/${runId}/events`)
      esRef.current = es
      es.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data as string) as RunEvent
          setTimeline((prev) => {
            const next = reduceRunEvent(prev, ev)
            if (next.status === 'completed' || next.status === 'failed') {
              es.close()
              esRef.current = null
              setRunning(false)
            }
            return next
          })
        } catch {
          /* ignore malformed event */
        }
      }
      es.onerror = () => {
        es.close()
        esRef.current = null
        setRunning(false)
      }
    },
    [],
  )

  return { timeline, running, error, start, stop }
}
