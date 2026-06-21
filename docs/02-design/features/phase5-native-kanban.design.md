# Design — Phase 5: 네이티브 칸반 read 스왑

## Context Anchor
(Plan) dashboard REST 미기동 → better-sqlite3로 네이티브 kanban.db readonly read. v1 read 스왑(UI 유지).

## 아키텍처 옵션
- **A. dashboard:9119 `/api/plugins/kanban/` 프록시**: 원계획. 현재 dashboard 미기동 + 세션 토큰 필요 → 지금 불가. 향후 옵션.
- **B. better-sqlite3 DB 직접 read (선택)**: `~/.hermes/profiles/<p>/kanban.db` readonly. dashboard·모델 무관, 지금 동작. event-store가 쓰는 동일 패턴(createRequire). 동시 쓰기는 SQLite/WAL이 처리, read는 안전.
- **C. `hermes kanban` CLI exec**: 정확하나 요청마다 프로세스 spawn → 느리고 취약. read에는 과함.

→ **B 선택**(read). 쓰기는 v1 범위 외(네이티브 무결성/이벤트는 CLI·봇이 담당).

## 변경 사항
### 1. `src/server/native-kanban-store.ts` (신규)
- `createRequire(import.meta.url)`로 better-sqlite3 동적 로드(event-store 패턴).
- `kanbanDbPath()`: `join(homedir, '.hermes/profiles', PROFILE, 'kanban.db')`, PROFILE = `HERMESTALK_KANBAN_PROFILE` || `HERMES_PROFILE` || 'maccoder'.
- `isNativeKanbanAvailable()`: 파일 존재.
- `listNativeTasks(filter)`: readonly 쿼리 + 매핑 → `HermesTask[]`. 컬럼 필터는 status 역매핑.
- `getNativeTask(id)`.
- 매핑:
  - status→column: triage→backlog, todo→todo, ready→todo, running→in_progress, blocked→review, done→done.
  - priority(int)→TaskPriority: >=66 high, 34–65 medium, <34 low.
  - title→title, body→description, assignee→assignee, created_at*1000→createdAt, (completed_at||started_at||created_at)*1000→updatedAt.
  - sourceType 'manual', tags [], position = priority 역순 index.
- 매 호출 시 open→read→close(짧은 커넥션, readonly). 단순/안전 우선.

### 2. 라우트 분기 (최소 침습)
- `src/routes/api/tasks/index.ts` GET: `isNativeKanbanAvailable()` 면 `listNativeTasks(filter)`, 아니면 기존 `listTasks(filter)`.
- `src/routes/api/tasks/$taskId.ts` GET: 동일 분기(`getNativeTask` 우선).
- POST/move/update/delete: 네이티브 모드에서는 v1 미지원(파일 store 경로 유지하되, 네이티브 모드 사용 시 보드는 read-only 현실 반영). 후속에서 CLI 연동.

## 검증 계획 (real, 모델 무관)
- L1: `curl /api/tasks` → 네이티브 7태스크, 컬럼=done, assignee 매핑 확인.
- 단위: status/priority 매핑 함수 경계값.
- 빌드: tsc 0에러, vite 트랜스폼 200.

## 리스크
- DB 스키마 변경 시 매핑 깨짐 → 방어적 매핑 + 알 수 없는 status는 backlog 폴백.
- 다중 프로필(여러 kanban.db) → v1은 단일 PROFILE. 후속에서 발견된 게이트웨이별 보드.
