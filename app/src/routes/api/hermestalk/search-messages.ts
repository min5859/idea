/**
 * HermesTalk — 메시지 검색 API (Phase 3)
 *
 * GET /api/hermestalk/search-messages?q=...&limit=30
 * 프로필 state.db의 messages_fts(FTS5)를 readonly 검색.
 */
import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../../server/auth-middleware'
import {
  isMessageSearchAvailable,
  searchMessages,
} from '../../../server/message-search'

export const Route = createFileRoute('/api/hermestalk/search-messages')({
  server: {
    handlers: {
      GET: ({ request }) => {
        if (!isAuthenticated(request)) {
          return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        const url = new URL(request.url)
        const q = url.searchParams.get('q')?.trim() ?? ''
        const limitParam = Number(url.searchParams.get('limit'))
        const limit =
          Number.isFinite(limitParam) && limitParam > 0
            ? Math.min(limitParam, 100)
            : 30

        if (!isMessageSearchAvailable()) {
          return Response.json({ ok: true, available: false, hits: [] })
        }
        if (!q) {
          return Response.json({ ok: true, available: true, hits: [] })
        }
        return Response.json({
          ok: true,
          available: true,
          hits: searchMessages(q, limit),
        })
      },
    },
  },
})
