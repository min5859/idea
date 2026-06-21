/**
 * HermesTalk — 메시지 전문검색 (Phase 3, 모델 무관)
 *
 * Hermes 프로필 `state.db`에는 messages 테이블 + messages_fts(FTS5) 인덱스가
 * 이미 유지된다. 이를 readonly로 단일 FTS MATCH 쿼리해 메시지를 검색한다.
 * (게이트웨이/모델 무관, 단일 쿼리라 과거 클라 수집식 freezing 위험 없음.)
 */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'

const _require = createRequire(import.meta.url)

type SqliteDb = Database.Database

function searchProfile(): string {
  return (
    process.env.HERMESTALK_KANBAN_PROFILE ||
    process.env.HERMES_PROFILE ||
    'maccoder'
  )
}

function stateDbPath(): string {
  return join(homedir(), '.hermes', 'profiles', searchProfile(), 'state.db')
}

export function isMessageSearchAvailable(): boolean {
  try {
    return existsSync(stateDbPath())
  } catch {
    return false
  }
}

export type MessageHit = {
  id: number
  sessionId: string
  role: string
  snippet: string
  timestamp: number
}

/**
 * FTS5 MATCH 식으로 안전 변환: 공백 토큰을 따옴표로 감싸 특수문자 구문오류 방지.
 * 내부 따옴표는 두 번으로 이스케이프. 토큰은 prefix 매칭(*)을 허용.
 */
function toFtsQuery(raw: string): string {
  const tokens = raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .map((t) => `"${t.replace(/"/g, '""')}"*`)
  return tokens.join(' ')
}

export function searchMessages(query: string, limit = 30): Array<MessageHit> {
  const q = query.trim()
  if (!q) return []
  const ftsExpr = toFtsQuery(q)
  if (!ftsExpr) return []

  let db: SqliteDb | null = null
  try {
    const DatabaseCtor = _require('better-sqlite3') as typeof Database
    db = new DatabaseCtor(stateDbPath(), {
      readonly: true,
      fileMustExist: true,
    })
    const rows = db
      .prepare(
        `SELECT m.id AS id, m.session_id AS sessionId, m.role AS role,
                m.content AS content, m.timestamp AS timestamp
         FROM messages_fts f
         JOIN messages m ON m.id = f.rowid
         WHERE f.content MATCH ?
           AND m.content IS NOT NULL AND m.content != ''
         ORDER BY rank
         LIMIT ?`,
      )
      .all(ftsExpr, limit) as Array<{
      id: number
      sessionId: string
      role: string
      content: string
      timestamp: number
    }>
    return rows.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      role: r.role,
      snippet: r.content.slice(0, 200),
      timestamp: Math.round(r.timestamp * 1000),
    }))
  } catch {
    return []
  } finally {
    try {
      db?.close()
    } catch {
      /* ignore */
    }
  }
}
