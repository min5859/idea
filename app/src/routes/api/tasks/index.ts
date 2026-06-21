/**
 * GET  /api/tasks   — list tasks with optional filters (column, assignee, priority, sourceType, sourceId)
 * POST /api/tasks   — create a task (requires title)
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { requireJsonContentType } from '../../../server/rate-limit'
import { createTask, listTasks } from '../../../server/task-store'
import {
  isNativeKanbanAvailable,
  listNativeTasks,
} from '../../../server/native-kanban-store'
import type { TaskColumn, TaskPriority, TaskSourceType } from '../../../types/task'

const VALID_COLUMNS: Array<TaskColumn> = ['backlog', 'todo', 'in_progress', 'review', 'done']
const VALID_PRIORITIES: Array<TaskPriority> = ['high', 'medium', 'low']
const VALID_SOURCES: Array<TaskSourceType> = ['manual', 'conductor', 'crew']

export const Route = createFileRoute('/api/tasks/')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(request.url)
        const filter: Parameters<typeof listTasks>[0] = {}

        const column = url.searchParams.get('column')
        if (column && VALID_COLUMNS.includes(column as TaskColumn)) {
          filter.column = column as TaskColumn
        }

        const assignee = url.searchParams.get('assignee')
        if (assignee) filter.assignee = assignee

        const priority = url.searchParams.get('priority')
        if (priority && VALID_PRIORITIES.includes(priority as TaskPriority)) {
          filter.priority = priority as TaskPriority
        }

        const sourceType = url.searchParams.get('sourceType')
        if (sourceType && VALID_SOURCES.includes(sourceType as TaskSourceType)) {
          filter.sourceType = sourceType as TaskSourceType
        }

        const sourceId = url.searchParams.get('sourceId')
        if (sourceId) filter.sourceId = sourceId

        // Phase 5: 네이티브 칸반(kanban.db) 가용 시 그걸 단일 진실원천으로 read.
        // 없으면 Studio 자체 file store로 폴백(UI는 동일 형태라 무수정).
        if (isNativeKanbanAvailable()) {
          return json({
            ok: true,
            tasks: listNativeTasks({
              column: filter.column,
              assignee: filter.assignee,
            }),
            source: 'native-kanban',
          })
        }

        return json({ ok: true, tasks: listTasks(filter) })
      },

      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck

        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

        const title = typeof body.title === 'string' ? body.title.trim() : ''
        if (!title) {
          return json({ ok: false, error: 'title is required' }, { status: 400 })
        }

        const input: Parameters<typeof createTask>[0] = { title }

        if (typeof body.description === 'string') input.description = body.description
        if (typeof body.column === 'string' && VALID_COLUMNS.includes(body.column as TaskColumn)) {
          input.column = body.column as TaskColumn
        }
        if (typeof body.priority === 'string' && VALID_PRIORITIES.includes(body.priority as TaskPriority)) {
          input.priority = body.priority as TaskPriority
        }
        if (typeof body.assignee === 'string' || body.assignee === null) {
          input.assignee = body.assignee
        }
        if (Array.isArray(body.tags)) {
          input.tags = (body.tags as Array<unknown>).filter((t) => typeof t === 'string')
        }
        if (typeof body.dueDate === 'string' || body.dueDate === null) {
          input.dueDate = body.dueDate
        }
        if (typeof body.sourceType === 'string' && VALID_SOURCES.includes(body.sourceType as TaskSourceType)) {
          input.sourceType = body.sourceType as TaskSourceType
        }
        if (typeof body.sourceId === 'string' || body.sourceId === null) {
          input.sourceId = body.sourceId
        }
        if (typeof body.createdBy === 'string') input.createdBy = body.createdBy

        const task = createTask(input)
        return json({ ok: true, task }, { status: 201 })
      },
    },
  },
})
