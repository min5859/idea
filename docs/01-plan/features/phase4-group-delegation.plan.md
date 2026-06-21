# Plan — Phase 4: 그룹방 위임 (방식 A, delegate_task) ★하이라이트

## Executive Summary
| 관점 | 내용 |
|---|---|
| Problem | 리더 에이전트가 서브에이전트에게 위임·취합하는 과정을 메신저 그룹방처럼 보고 싶다. 현재 Studio는 위임을 tool 카드로만 렌더(채팅 일반 흐름). |
| Solution | 한 게이트웨이 안 위임(방식 A)을 `/v1/runs`로 트리거하고, `/v1/runs/{id}/events` SSE의 `delegate_task` function_call·서브에이전트 lifecycle을 시간순 "위임 말풍선"으로 렌더. @mention으로 특정 워커 지목. |
| Function/UX | 그룹방=리더 프로필 세션. 사용자가 멀티파트 작업 전송 → 리더가 delegate_task로 분기 → 각 위임/결과가 말풍선 → 최종 취합. |
| Core Value | 요구 #3·#5 — "그룹방에서 리더가 위임하는 과정이 보이고 최종 취합". 게이트웨이 N개 안 띄워도 됨(단일 orchestrator). |

## Context Anchor
| 항목 | 내용 |
|---|---|
| WHY | 위임 과정 가시화가 멀티에이전트 메신저의 핵심 차별 경험. |
| WHO | 본인이 리더 봇에게 복합 작업을 주고 위임·취합을 한눈에 본다. |
| RISK | 위임 이벤트 형태 오해 → 잘못 렌더. **완화: 실제 이벤트 캡처 선행**(현재 모델 재인증 대기). UX 과설계 → 최소 침습 우선. |
| SUCCESS | real run에서 delegate_task function_call + 서브에이전트 진행 + 취합이 그룹방에 시간순으로 보임. |
| SCOPE | 방식 A(단일 게이트웨이 내 위임)만. 방식 B(칸반 협업)는 Phase 5. |

## 실측 기반 사실 (캡처 완료/대기)
- `POST /v1/runs {model, input}` → `{run_id, status:"started"}` (✅ 실측, run_id 형식 `run_<hex>`).
- `GET /v1/runs/{id}/events` SSE: lifecycle은 `data: {"event":"run.failed"|...}` (필드명 `event`). ✅ run.failed 실측.
- 위임 = `response.output_item.added/done`의 `item.type=="function_call"` & `name=="delegate_task"` (문서 + Phase0). **real 위임 흐름 캡처는 모델 재인증 후** (현재 Codex 토큰 소비로 run.failed).
- 기존 자산: 프록시 `api/hermes-runs.ts`(POST)·`api/hermes-runs.$runId.events.ts`(SSE), delegate_task tool 카드 `message-item.tsx`(👥), composer `chat-composer.tsx`.

## Requirements
- R1: 그룹방(=리더 세션) 진입점. 사이드바 Agents에서 orchestrator 가능 게이트웨이를 그룹방으로 열거나, 기존 chat에 group 모드 토글.
- R2: 그룹방 전송 시 `/v1/runs`로 라우팅(일반 sessions/send 대신) → 위임 이벤트 SSE 구독.
- R3: `delegate_task` function_call + 서브에이전트 delta/완료를 시간순 위임 말풍선으로 렌더(기존 카드 재스타일).
- R4: @mention(`chat-composer.tsx`)으로 특정 워커/역할 지목 → 프롬프트에 주입.
- R5: real run에서 위임→취합 흐름 검증(모델 재인증 후).

## Success Criteria
- SC1: 그룹방에서 멀티파트 작업 전송 → run 생성 → delegate_task 이벤트 수신·렌더. (real, 재인증 후)
- SC2: 위임 말풍선이 리더/워커 구분되어 시간순 표시.
- SC3: @mention 토큰이 run input에 반영.
- SC4: 최소 침습 — 기존 chat 화면 확장 + runs 프록시 재사용. Conductor(관제 대시보드)와 분리 유지.

## Out of Scope
- 방식 B 칸반 협업(Phase 5). 여러 게이트웨이 동시 위임.

## 현재 상태
- plan/design: 진행(모델 무관). **do/check(real 위임 캡처·구현·검증): 모델(Codex) 재인증 후 진행** — 사용자 `codex`/`hermes auth` 필요.
