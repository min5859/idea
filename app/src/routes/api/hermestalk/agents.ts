/**
 * HermesTalk — PC별 다중 게이트웨이 자동 발견 (요구 #2)
 *
 * Studio는 단일 게이트웨이(HERMES_API_URL) 모델이지만, HermesTalk는
 * "에이전트 1개 = 게이트웨이 1개(포트)"라 이 PC에서 떠 있는 게이트웨이들을
 * probe해 살아있는 것만 "채팅방=에이전트"로 돌려준다.
 *
 * 후보 목록: env HERMESTALK_GATEWAYS (콤마 구분 baseUrl).
 *   예) HERMESTALK_GATEWAYS=http://127.0.0.1:8642,http://127.0.0.1:8643
 * 미설정 시 HERMES_API_URL(또는 기본 8642) 1개만 본다.
 *
 * 비침습: Studio 기존 코드를 건드리지 않는 새 라우트.
 */
import { createFileRoute } from '@tanstack/react-router'

const PROBE_TIMEOUT_MS = 2500

function candidateGateways(): string[] {
  const raw = process.env.HERMESTALK_GATEWAYS?.trim()
  if (raw) {
    return raw
      .split(',')
      .map((s) => s.trim().replace(/\/+$/, ''))
      .filter(Boolean)
  }
  const single = (process.env.HERMES_API_URL || 'http://127.0.0.1:8642').replace(
    /\/+$/,
    '',
  )
  return [single]
}

type DiscoveredAgent = {
  id: string
  baseUrl: string
  model: string | null
  online: boolean
}

async function probeOne(baseUrl: string): Promise<DiscoveredAgent> {
  const headers: Record<string, string> = {}
  if (process.env.HERMES_API_TOKEN) {
    headers.Authorization = `Bearer ${process.env.HERMES_API_TOKEN}`
  }
  // health
  const online = await fetch(`${baseUrl}/health`, {
    headers,
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  })
    .then((r) => r.ok)
    .catch(() => false)

  // model name (= 프로필 = 에이전트 식별자)
  let model: string | null = null
  if (online) {
    model = await fetch(`${baseUrl}/v1/models`, {
      headers,
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j?.data?.[0]?.id as string) ?? null)
      .catch(() => null)
  }

  // 포트를 안정적 id로 사용(없으면 baseUrl)
  const port = baseUrl.match(/:(\d+)/)?.[1]
  return { id: model || `gw-${port ?? baseUrl}`, baseUrl, model, online }
}

export const Route = createFileRoute('/api/hermestalk/agents')({
  server: {
    handlers: {
      GET: async () => {
        const candidates = candidateGateways()
        const probed = await Promise.all(candidates.map(probeOne))
        const agents = probed.filter((a) => a.online)
        return Response.json({
          ok: true,
          candidates: candidates.length,
          online: agents.length,
          agents,
        })
      },
    },
  },
})
