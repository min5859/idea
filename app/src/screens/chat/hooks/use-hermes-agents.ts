import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

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

// ── 활성 게이트웨이(어느 봇과 채팅 중인가) ──────────────────────────────

export const activeGatewayQueryKey = ['hermestalk', 'active-gateway'] as const

async function fetchActiveGateway(): Promise<string> {
  const res = await fetch('/api/hermestalk/active-gateway')
  if (!res.ok) throw new Error(`active-gateway fetch failed: ${res.status}`)
  const json = (await res.json()) as { baseUrl?: string }
  return json.baseUrl ?? ''
}

async function postActiveGateway(baseUrl: string): Promise<string> {
  const res = await fetch('/api/hermestalk/active-gateway', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseUrl }),
  })
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    baseUrl?: string
    error?: string
  }
  if (!res.ok || !json.ok) {
    throw new Error(json.error || `switch failed: ${res.status}`)
  }
  return json.baseUrl ?? baseUrl
}

/**
 * 현재 활성 게이트웨이 조회 + 전환 mutation.
 * 전환 성공 시 connection/gateway 상태 쿼리를 무효화해 presence/capability를 갱신한다.
 */
export function useActiveGateway() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: activeGatewayQueryKey,
    queryFn: fetchActiveGateway,
    refetchInterval: 15_000,
    retry: false,
  })

  const mutation = useMutation({
    mutationFn: postActiveGateway,
    onSuccess: (baseUrl) => {
      queryClient.setQueryData(activeGatewayQueryKey, baseUrl)
      void queryClient.invalidateQueries({
        queryKey: ['hermes', 'connection-status'],
      })
      void queryClient.invalidateQueries({ queryKey: hermesAgentsQueryKey })
    },
  })

  return {
    activeBaseUrl: query.data ?? '',
    switchGateway: mutation.mutate,
    switching: mutation.isPending,
    pendingBaseUrl: mutation.isPending ? mutation.variables : null,
  }
}
