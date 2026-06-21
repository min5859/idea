/**
 * HermesTalk — 네이티브 칸반 read 스토어 (Phase 5)
 *
 * Studio 자체 보드(.runtime/tasks.json)를 Hermes 네이티브 칸반
 * (`~/.hermes/profiles/<profile>/kanban.db`)으로 스왑. dashboard:9119 REST가
 * 미기동이라 better-sqlite3로 DB를 readonly 직접 read한다(event-store와 동일 패턴).
 *
 * v1은 read 전용(보드 반영). 쓰기(create/claim/move)는 네이티브 무결성·이벤트
 * 발행상 `hermes kanban` CLI / 봇이 담당. → 두 PC/텔레그램이 같은 보드를 본다.
 */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { HermesTask, TaskColumn, TaskPriority } from '../types/task'

const _require = createRequire(import.meta.url)

type SqliteDb = import('better-sqlite3').Database

function kanbanProfile(): string {
  return (
    process.env.HERMESTALK_KANBAN_PROFILE ||
    process.env.HERMES_PROFILE ||
    'maccoder'
  )
}

function kanbanDbPath(): string {
  return join(homedir(), '.hermes', 'profiles', kanbanProfile(), 'kanban.db')
}

export function isNativeKanbanAvailable(): boolean {
  try {
    return existsSync(kanbanDbPath())
  } catch {
    return false
  }
}

// 네이티브 status → Studio 컬럼
const STATUS_TO_COLUMN: Record<string, TaskColumn> = {
  triage: 'backlog',
  todo: 'todo',
  ready: 'todo',
  running: 'in_progress',
  blocked: 'review',
  done: 'done',
}

function columnForStatus(status: string): TaskColumn {
  return STATUS_TO_COLUMN[status] ?? 'backlog'
}

// Studio 컬럼 → 매칭되는 네이티브 status들(필터 역매핑)
const COLUMN_TO_STATUSES: Record<TaskColumn, string[]> = {
  backlog: ['triage'],
  todo: ['todo', 'ready'],
  in_progress: ['running'],
  review: ['blocked'],
  done: ['done'],
}

function priorityTier(priority: number | null): TaskPriority {
  const p = typeof priority === 'number' ? priority : 0
  if (p >= 66) return 'high'
  if (p >= 34) return 'medium'
  return 'low'
}

type NativeRow = {
  id: string
  title: string
  body: string | null
  assignee: string | null
  status: string
  priority: number | null
  created_by: string | null
  created_at: number
  started_at: number | null
  completed_at: number | null
}

function rowToTask(row: NativeRow, position: number): HermesTask {
  const updatedSec = row.completed_at ?? row.started_at ?? row.created_at
  return {
    id: row.id,
    title: row.title,
    description: row.body ?? '',
    column: columnForStatus(row.status),
    priority: priorityTier(row.priority),
    assignee: row.assignee ?? null,
    tags: [],
    dueDate: null,
    position,
    sourceType: 'manual',
    sourceId: null,
    createdBy: row.created_by ?? 'kanban',
    createdAt: row.created_at * 1000,
    updatedAt: updatedSec * 1000,
  }
}

const SELECT_COLS =
  'id, title, body, assignee, status, priority, created_by, created_at, started_at, completed_at'

function withDb<T>(fn: (db: SqliteDb) => T): T | null {
  let db: SqliteDb | null = null
  try {
    const Database = _require(
      'better-sqlite3',
    ) as typeof import('better-sqlite3')
    db = new Database(kanbanDbPath(), { readonly: true, fileMustExist: true })
    return fn(db)
  } catch {
    return null
  } finally {
    try {
      db?.close()
    } catch {
      /* ignore */
    }
  }
}

export type NativeTaskFilter = {
  column?: TaskColumn
  assignee?: string
}

export function listNativeTasks(filter?: NativeTaskFilter): HermesTask[] {
  const rows = withDb((db) => {
    const where: string[] = []
    const params: Array<string> = []
    if (filter?.column) {
      const statuses = COLUMN_TO_STATUSES[filter.column]
      where.push(`status IN (${statuses.map(() => '?').join(',')})`)
      params.push(...statuses)
    }
    if (filter?.assignee) {
      where.push('assignee = ?')
      params.push(filter.assignee)
    }
    const sql =
      `SELECT ${SELECT_COLS} FROM tasks` +
      (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
      ' ORDER BY priority DESC, created_at DESC'
    return db.prepare(sql).all(...params) as NativeRow[]
  })
  if (!rows) return []
  return rows.map((row, i) => rowToTask(row, i))
}

export function getNativeTask(taskId: string): HermesTask | null {
  const row = withDb((db) => {
    return (
      (db
        .prepare(`SELECT ${SELECT_COLS} FROM tasks WHERE id = ?`)
        .get(taskId) as NativeRow | undefined) ?? null
    )
  })
  return row ? rowToTask(row, 0) : null
}
