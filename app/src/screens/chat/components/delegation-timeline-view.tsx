'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import { UserMultiple02Icon } from '@hugeicons/core-free-icons'
import type { DelegationTimeline } from '../delegation-events'
import { cn } from '@/lib/utils'

/**
 * HermesTalk — 그룹방 위임 타임라인 뷰 (Phase 4 do)
 *
 * delegation-events 파서가 만든 DelegationTimeline을 시간순 "위임 말풍선"으로
 * 렌더한다. 리더 텍스트(취합) + 각 위임(목표/지목 워커/결과) + 상태.
 * (파서 출력 형태는 단위 테스트로 검증됨. 라이브 content는 모델 재인증 후.)
 */

const STATUS_LABEL: Record<DelegationTimeline['status'], string> = {
  created: '대기',
  in_progress: '진행 중',
  completed: '완료',
  failed: '실패',
}

export function DelegationTimelineView({
  timeline,
}: {
  timeline: DelegationTimeline
}) {
  const { status, error, assistantText, delegations } = timeline

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 font-medium',
            status === 'completed'
              ? 'bg-emerald-500/10 text-emerald-600'
              : status === 'failed'
                ? 'bg-red-500/10 text-red-600'
                : 'bg-accent-500/10 text-accent-600',
          )}
        >
          {STATUS_LABEL[status]}
        </span>
        {delegations.length > 0 ? (
          <span className="text-primary-500">위임 {delegations.length}건</span>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg bg-red-500/5 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {/* 위임 말풍선들 */}
      {delegations.map((d) => (
        <div
          key={d.callId}
          className="rounded-xl border border-primary-200 bg-[var(--theme-card)] p-3"
        >
          <div className="mb-1 flex items-center gap-2">
            <HugeiconsIcon
              icon={UserMultiple02Icon}
              size={16}
              strokeWidth={1.5}
              className="text-accent-500"
            />
            <span className="text-xs font-semibold text-accent-600">
              위임{d.target ? ` → @${d.target}` : ''}
            </span>
            <span
              className={cn(
                'ml-auto text-[10px]',
                d.status === 'done' ? 'text-emerald-600' : 'text-primary-400',
              )}
            >
              {d.status === 'done' ? '결과 도착' : '진행 중'}
            </span>
          </div>
          {d.goal ? (
            <div className="text-sm text-primary-900">{d.goal}</div>
          ) : null}
          {d.result ? (
            <div className="mt-2 whitespace-pre-wrap rounded-lg bg-primary-100 px-2.5 py-1.5 text-sm text-primary-800">
              {d.result}
            </div>
          ) : null}
        </div>
      ))}

      {/* 리더 취합 텍스트 */}
      {assistantText ? (
        <div className="whitespace-pre-wrap rounded-xl bg-accent-500/5 px-3 py-2 text-sm text-primary-900">
          {assistantText}
        </div>
      ) : null}

      {status !== 'failed' &&
      delegations.length === 0 &&
      !assistantText ? (
        <div className="text-sm text-primary-500">
          리더에게 복합 작업을 보내면 위임 과정이 여기 시간순으로 보입니다.
        </div>
      ) : null}
    </div>
  )
}
