/**
 * HermesTalk — 활성 게이트웨이 전환 (Phase 2 완료)
 *
 * GET  → 현재 활성 게이트웨이 baseUrl
 * POST { baseUrl } → 후보 목록에 속한 baseUrl로 전역 전환 + 재probe → 새 capability 반환
 *
 * 보안: candidateGateways()(env HERMESTALK_GATEWAYS / HERMES_API_URL)에 속한
 * baseUrl만 허용 → 임의 호스트 전환(SSRF/오용) 차단.
 *
 * 비침습: Studio 채팅 경로는 그대로. HERMES_API live-binding 재할당만으로 라우팅 전환.
 */
import { createFileRoute } from '@tanstack/react-router'
import {
  getActiveGateway,
  probeGateway,
  setActiveGateway,
} from '../../../server/gateway-capabilities'

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

export const Route = createFileRoute('/api/hermestalk/active-gateway')({
  server: {
    handlers: {
      GET: () => {
        return Response.json({ ok: true, baseUrl: getActiveGateway() })
      },
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          baseUrl?: unknown
        }
        const baseUrl =
          typeof body.baseUrl === 'string'
            ? body.baseUrl.trim().replace(/\/+$/, '')
            : ''
        if (!baseUrl) {
          return Response.json(
            { ok: false, error: 'baseUrl required' },
            { status: 400 },
          )
        }
        if (!candidateGateways().includes(baseUrl)) {
          return Response.json(
            { ok: false, error: 'baseUrl not in allowed candidates' },
            { status: 400 },
          )
        }

        setActiveGateway(baseUrl)
        const capabilities = await probeGateway({ force: true })
        return Response.json({
          ok: true,
          baseUrl: getActiveGateway(),
          capabilities,
        })
      },
    },
  },
})
