import { HugeiconsIcon } from '@hugeicons/react'
import { AiUserIcon } from '@hugeicons/core-free-icons'
import { useHermesAgents } from '../../hooks/use-hermes-agents'
import type { DiscoveredAgent } from '../../hooks/use-hermes-agents'
import { cn } from '@/lib/utils'
import {
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/**
 * HermesTalk — 사이드바 "Agents"(채팅방) 섹션 (요구 #2 / Phase 2 UI)
 *
 * Studio 내장 crew(단일 게이트웨이 공유 페르소나) 대신, 이 PC에서 실제로 떠 있는
 * Hermes 게이트웨이들을 `/api/hermestalk/agents`로 발견해 "에이전트 채팅방"으로
 * 보여준다. 목록에 떠 있다는 것 자체가 presence(online).
 *
 * 비침습: chat-sidebar.tsx에서 세션 목록 위에 끼워 넣는 신규 섹션.
 * 게이트웨이 전환(클릭→해당 봇과 채팅) 자체는 백엔드가 단일 게이트웨이
 * 하드와이어드라 후속 Phase에서 배선한다. 지금은 발견 + presence 표시까지.
 */

function PresenceDot({ online }: { online: boolean }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {online && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/40" />
      )}
      <span
        className={cn(
          'relative inline-flex h-2 w-2 rounded-full',
          online ? 'bg-emerald-500' : 'bg-primary-400',
        )}
      />
    </span>
  )
}

function agentLabel(agent: DiscoveredAgent): string {
  if (agent.model) return agent.model
  return agent.id
}

function agentPort(agent: DiscoveredAgent): string {
  return agent.baseUrl.match(/:(\d+)/)?.[1] ?? agent.baseUrl
}

function AgentRow({ agent }: { agent: DiscoveredAgent }) {
  return (
    <TooltipProvider>
      <TooltipRoot>
        <TooltipTrigger
          render={
            <div className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-primary-900 hover:bg-primary-200 dark:hover:bg-primary-800">
              <HugeiconsIcon
                icon={AiUserIcon}
                size={20}
                strokeWidth={1.5}
                className="size-5 shrink-0 text-primary-500"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {agentLabel(agent)}
              </span>
              <span className="shrink-0 text-[10px] tabular-nums text-primary-500">
                :{agentPort(agent)}
              </span>
              <PresenceDot online={agent.online} />
            </div>
          }
        />
        <TooltipContent side="right">{agent.baseUrl}</TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  )
}

export function HermesAgentsSection() {
  const { agents, candidates, isLoading, error } = useHermesAgents()

  return (
    <div className="px-2">
      <div className="flex items-center gap-1.5 px-3 pt-3 pb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-primary-500 dark:text-neutral-400 select-none">
          Agents
        </span>
        {agents.length > 0 && (
          <span className="text-[10px] font-medium tabular-nums text-primary-400">
            {agents.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="px-3 py-2 text-xs text-primary-500">검색 중…</div>
      ) : error ? (
        <div className="px-3 py-2 text-xs text-red-500">발견 실패: {error}</div>
      ) : agents.length === 0 ? (
        <div className="px-3 py-2 text-xs text-primary-500">
          {candidates > 0
            ? '온라인 게이트웨이 없음'
            : '게이트웨이 후보 없음 (HERMESTALK_GATEWAYS)'}
        </div>
      ) : (
        <div className="space-y-0.5">
          {agents.map((agent) => (
            <AgentRow key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  )
}
