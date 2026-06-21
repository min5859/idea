# Plan — Phase 2 완료: 게이트웨이 전환 배선

## Executive Summary
| 관점 | 내용 |
|---|---|
| Problem | 사이드바 "Agents"에서 발견된 게이트웨이를 클릭해도 채팅이 그 봇으로 가지 않는다. Studio 채팅 백엔드가 단일 `HERMES_API`로 하드와이어드. |
| Solution | `HERMES_API`가 mutable `let` export(라이브 바인딩)임을 활용 — 활성 게이트웨이를 전역 전환하는 setter + 엔드포인트를 추가하고, 사이드바 에이전트 클릭이 이를 호출. |
| Function/UX | 에이전트 클릭 → 활성 표시(체크/하이라이트) → 이후 채팅이 그 게이트웨이로 라우팅. |
| Core Value | 요구 #1·#2 완성 — "그 PC에 떠 있는 에이전트를 골라 1:1 대화". 개인 단일 사용자 도구에 충분. |

## Context Anchor
| 항목 | 내용 |
|---|---|
| WHY | 발견만 되고 대화 라우팅이 안 되면 "채팅방"이 죽은 UI. |
| WHO | 집/회사 PC에서 본인이 그날 띄운 2~3개 게이트웨이를 오가며 사용. |
| RISK | per-request baseUrl 스레딩은 ~24파일 침습 → 업스트림 머지 파괴. 전역 전환으로 회피. |
| SUCCESS | 클릭한 게이트웨이로 `/v1/models`·capability·채팅이 실제 라우팅됨(실측). |
| SCOPE | 전역 활성 게이트웨이 1개 전환(동시 멀티룸 아님). 동시성은 비목표. |

## Requirements
- R1: 활성 게이트웨이를 런타임에 전환하는 서버 setter (`setActiveGateway(baseUrl)`).
- R2: POST 엔드포인트 `/api/hermestalk/active-gateway` (baseUrl 검증 → 전환 → 재probe → 새 capability 반환). GET으로 현재 활성 baseUrl 조회.
- R3: 사이드바 에이전트 행 클릭 → 엔드포인트 호출 → 활성 상태 표시.
- R4: 검증 — 후보 2개 중 online 1개로 전환 시 `/api/gateway-status`/`/v1/models`가 그 게이트웨이를 가리킴.

## Success Criteria
- SC1: `POST /api/hermestalk/active-gateway {baseUrl}` 후 `GET`이 그 baseUrl을 반환. ✅ 실측
- SC2: 전환 후 capability 재probe가 수행됨(probed=true, 해당 게이트웨이 기준).
- SC3: 최소 침습 — gateway-capabilities.ts setter 1개 + 신규 라우트 1개 + 사이드바 클릭 핸들러. Studio 원본 채팅 경로 무수정.

## Out of Scope
- 동시 멀티룸(룸마다 다른 게이트웨이 동시 스트리밍). per-request 스레딩 필요 → 후순위.
- 2번째 PC 실측(환경 부재).
