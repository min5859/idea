import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { usePageTitle } from '@/hooks/use-page-title'
import { useHermesAgents } from '@/screens/chat/hooks/use-hermes-agents'
import { useRunDelegation } from '@/screens/chat/hooks/use-run-delegation'
import { DelegationTimelineView } from '@/screens/chat/components/delegation-timeline-view'
import {
  applyMention,
  filterMentionCandidates,
  readMentionQuery,
} from '@/screens/chat/mention-utils'
import { Button } from '@/components/ui/button'

/**
 * HermesTalk — 그룹방 (Phase 4, 방식 A 위임)
 *
 * 리더 게이트웨이에 복합 작업을 보내면 /v1/runs로 위임이 트리거되고, delegate_task
 * 이벤트가 위임 말풍선으로 시간순 렌더된다. @mention으로 특정 워커/역할 지목.
 *
 * 활성 게이트웨이(사이드바 Agents에서 선택)가 리더. 라이브 위임은 모델 재인증 후.
 */
function GroupRoomScreen() {
  usePageTitle('Group Room')
  const { agents } = useHermesAgents()
  const { timeline, running, error, start } = useRunDelegation()
  const [text, setText] = useState('')

  const mentionQuery = readMentionQuery(text)
  const candidates = useMemo(
    () => agents.map((a) => a.model || a.id),
    [agents],
  )
  const mentionMatches =
    mentionQuery !== null
      ? filterMentionCandidates(candidates, mentionQuery).slice(0, 6)
      : []

  function send() {
    if (!text.trim() || running) return
    void start(text)
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 p-4">
      <div>
        <h1 className="text-lg font-semibold text-primary-900">그룹방 위임</h1>
        <p className="text-sm text-primary-500">
          활성 게이트웨이(리더)에 복합 작업을 보내면 위임 과정이 시간순으로 보입니다.
          @로 워커를 지목하세요.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-primary-200 p-3">
        <DelegationTimelineView timeline={timeline} />
      </div>

      <div className="relative">
        {mentionMatches.length > 0 ? (
          <div className="absolute bottom-full mb-1 w-full rounded-lg border border-primary-200 bg-[var(--theme-card)] py-1 shadow-lg">
            {mentionMatches.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setText((t) => applyMention(t, name))}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-primary-100"
              >
                @{name}
              </button>
            ))}
          </div>
        ) : null}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              send()
            }
          }}
          rows={3}
          placeholder="예: @frontend-eng UI 만들고 @reviewer 검수해줘 (⌘/Ctrl+Enter 전송)"
          className="w-full resize-none rounded-xl border border-primary-200 bg-[var(--theme-input,transparent)] p-3 text-sm outline-none focus:border-accent-500"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-primary-400">
            {error ? <span className="text-red-600">{error}</span> : null}
          </span>
          <Button type="button" size="sm" disabled={running} onClick={send}>
            {running ? '위임 진행 중…' : '전송'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/group')({
  component: GroupRoomScreen,
})
