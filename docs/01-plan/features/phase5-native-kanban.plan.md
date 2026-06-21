# Plan — Phase 5: 네이티브 칸반 전환 (방식 B)

## Executive Summary
| 관점 | 내용 |
|---|---|
| Problem | Studio 보드는 `.runtime/tasks.json`(앱 로컬)이라 봇/다른 PC/텔레그램과 단절. "그룹방 위임→봇 claim→같은 보드" 비전 불가. |
| Solution | 데이터 레이어를 **네이티브 칸반(`~/.hermes/profiles/<p>/kanban.db`)** 으로 스왑(UI 유지). dashboard:9119 REST가 미기동이므로 **better-sqlite3로 DB 직접 read**(readonly). |
| Function/UX | Studio Tasks 보드가 네이티브 칸반의 실제 태스크를 반영. 봇이 claim/complete하면 보드에 그대로 보임. |
| Core Value | 요구 #4 — 두 PC/텔레그램이 같은 네이티브 보드 공유. |

## Context Anchor
| 항목 | 내용 |
|---|---|
| WHY | 봇 협업(방식 B)의 단일 진실원천 = 네이티브 kanban.db. |
| WHO | 본인이 그룹방/CLI로 만든 태스크를 봇이 claim, 어느 화면에서나 같은 보드. |
| RISK | 원계획(dashboard REST 프록시)이 dashboard 미기동으로 막힘 → **DB 직접 read로 대체**(문서화). 동시 쓰기 SQLite 잠금. |
| SUCCESS | Studio `/api/tasks`가 네이티브 7개 실태스크를 컬럼 매핑해 반환(실측). |
| SCOPE | v1 = read 스왑(보드 반영). 쓰기(create/move)는 네이티브 무결성상 CLI/봇 관리 — v1은 read 우선. |

## 실측 사실
- dashboard :9119 미기동(000) → `/api/plugins/kanban/` REST 불가. api_server :8642엔 칸반 라우트 없음(404).
- `hermes kanban` CLI 동작, `kanban.db` 존재(139KB, 7 done 태스크). better-sqlite3 ^12.8.0 의존성 보유(event-store에서 사용 중).
- 네이티브 status: `triage/todo/ready/running/blocked/done`. created_at = Unix 초.

## Requirements
- R1: 네이티브 kanban.db readonly read → Studio `HermesTask` 형태로 매핑.
- R2: `/api/tasks` GET(list)·`/api/tasks/$taskId` GET을 네이티브 가용 시 네이티브로 스왑(UI 무수정). 미가용 시 기존 file store 폴백.
- R3: status→column 매핑(triage→backlog, todo/ready→todo, running→in_progress, blocked→review, done→done).
- R4: 프로필 선택 env `HERMESTALK_KANBAN_PROFILE`(기본 maccoder).

## Success Criteria
- SC1: `/api/tasks` 호출 → 네이티브 7태스크가 컬럼/assignee 매핑되어 반환. ✅ 실측 목표
- SC2: UI(Tasks 화면) 무수정으로 네이티브 보드 표시.
- SC3: 최소 침습 — 신규 native-kanban-store + 라우트 GET 분기. file store 코드 보존(폴백).

## Out of Scope (v1)
- Studio UI에서 네이티브로 create/move/delete 쓰기(무결성·이벤트 발행 위험 → CLI/봇 경로 유지). 후속.
- dashboard:9119 REST 프록시(미기동). 향후 dashboard 상시화 시 대안.
