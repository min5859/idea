import { useQuery } from '@tanstack/react-query'

/**
 * HermesTalk — PC별 발견된 게이트웨이(=에이전트 채팅방) 조회 훅 (요구 #2)
 *
 * `/api/hermestalk/agents`(서버측 다중 게이트웨이 probe)를 주기적으로 폴링한다.
 * 살아있는 게이트웨이만 돌아오므로, 목록에 남아있다는 것 자체가 presence(online)다.
 * 게이트웨이가 죽으면 다음 폴링에서 목록에서 빠진다.
 *
 * 비침습: Studio 기존 코드를 건드리지 않는 신규 훅.
 */

export type DiscoveredAgent = {
  id: string
  baseUrl: string
  model: string | null
  online: boolean
}

type AgentsResponse = {
  ok: boolean
  candidates: number
  online: number
  agents: Array<DiscoveredAgent>
}

async function fetchHermesAgents(): Promise<AgentsResponse> {
  const res = await fetch('/api/hermestalk/agents')
  if (!res.ok) throw new Error(`agents probe failed: ${res.status}`)
  return (await res.json()) as AgentsResponse
}

export const hermesAgentsQueryKey = ['hermestalk', 'agents'] as const

export function useHermesAgents() {
  const query = useQuery({
    queryKey: hermesAgentsQueryKey,
    queryFn: fetchHermesAgents,
    refetchInterval: 10_000,
    retry: false,
  })

  return {
    agents: query.data?.agents ?? [],
    candidates: query.data?.candidates ?? 0,
    online: query.data?.online ?? 0,
    isLoading: query.isLoading && !query.data,
    error: query.error instanceof Error ? query.error.message : null,
  }
}
