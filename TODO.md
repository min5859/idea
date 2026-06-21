# HermesTalk — TODO (실사용 개인 도구)

목표: **Hermes Studio를 포크**해서, 집/회사 PC에서 실제로 쓰는 멀티에이전트 메신저로 만든다.
원칙: **real-first(mock 없음) · 최소 침습(Studio 레이어로 얹기) · 막히면 보고.**
핵심 순위: ①PC별 에이전트 자동표시 → ②1:1 real 스트리밍 → ③그룹방 위임 → ④네이티브 칸반.

> 자세한 결정·근거·코드 위치는 `CLAUDE.md` 참조.

---

## Phase 0 — Hermes 환경 + 사실 검증 ✅ 완료 (결과: `PHASE0-VERIFICATION.md`)
- [x] 현재 프로필 = `maccoder` 1개(launchd 상시 가동). 텔레그램 동작 중
- [x] api_server 활성화: **프로필** `.env`에 `API_SERVER_ENABLED=true` → `hermes --profile maccoder gateway restart` → `:8642` 동작(2 platforms), `/v1/models` 실호출 확인
- [x] `<프로필> gateway` = launchd 서비스로 부팅 자동 기동 확인됨
- [x] `/v1/runs` 계열 SSE 엔드포인트 + 위임 모델 확인: **`delegate_task`는 function_call 아이템**으로 옴(별도 이벤트 없음)
- [x] `orchestrator_enabled: true` 확인 → delegate_task 사용 가능
- [x] 네이티브 칸반: 프로필별 `kanban.db` + `hermes kanban` CLI 확인. REST는 dashboard(:9119) `/api/plugins/kanban/`
- [ ] (Phase 1 이후) 텔레그램↔웹 세션 공유, 위임 이벤트 raw 캡처는 실제 채팅 시 확인

## Phase 1 — Studio 포크 셋업 ✅ 대체로 완료
- [x] `JPeetz/Hermes-Studio` v1.20.0 클론 → `app/`에 포크로 들임(LICENSE 유지). pnpm 설치 + 네이티브 빌드(allowBuilds)
- [x] 게이트웨이 연결 확인: `pnpm dev`(:3000) → `/api/connection-status` ok, `/api/gateway-status` capability 자동 감지(chat·models·streaming·jobs=true)
- [x] 실행/포크 안내: `app/HERMESTALK-FORK.md`
- [ ] 포크 운영 방침: 업스트림 추적 + 우리 변경 별도 커밋(머지 최소 침습) — 진행 중 원칙으로 유지
- [x] from-scratch 잔재 코드 `legacy/`로 이동 보관 완료(`agents.ts`·`skills.ts`·`types.ts`, 코드 정본은 포크라 미사용)
- [ ] **mockup.html 재작도 결정**: 지금은 "메신저 UX 레이어 디자인 타깃"으로 역할만 재정의 + 틀린 사실 수정 완료. 전면 재작도는 **포크를 띄워 Studio 실제 화면을 본 뒤**, 그 위에 얹을 부분(채팅방=에이전트·presence·위임 말풍선·@mention)만 Studio 화면 기준으로 다시 그린다 (지금 추측으로 전면 재작도하지 않음)

## Phase 2 — PC별 에이전트 자동 표시 (요구 2) — 백엔드 ✅ / UI ✅
- [x] 후보 게이트웨이 목록 = env `HERMESTALK_GATEWAYS`(콤마구분), 미설정 시 단일 기본
- [x] 다중 게이트웨이 probe 라우트 `app/src/routes/api/hermestalk/agents.ts` 추가(비침습) — `/health`+`/v1/models`로 살아있는 것만 반환. 검증: candidates:2→online:1(가짜 필터)
- [x] **(UI)** `chat-sidebar.tsx`에 "Agents" 섹션 추가 — 발견된 게이트웨이를 "채팅방"으로 렌더 + presence 뱃지(emerald ping). 신규 파일만(`hooks/use-hermes-agents.ts` 10s 폴링, `components/sidebar/hermes-agents-section.tsx`) + 사이드바 2줄 주입(비침습). 실측: candidates 2→online 1(maccoder :8642), tsc 0에러, vite 트랜스폼 200
- [x] **(전환 배선)** 에이전트 클릭→해당 게이트웨이로 전역 전환. `HERMES_API` live-binding `let`을 `setActiveGateway()`로 재할당 + `probeGateway({force})` 재probe(최소 침습, 채팅 경로 무수정). 신규 라우트 `api/hermestalk/active-gateway.ts`(GET/POST, 후보 검증=SSRF 가드), 사이드바 행 클릭+활성 하이라이트. 실측: 9999→400, 8643(offline)→capability false, 8642→health/models true
  - ⏳ (비목표) 동시 멀티룸(룸마다 다른 게이트웨이 동시 스트리밍)은 per-request 스레딩 필요 → 후순위
- [ ] 집/회사 PC에서 각각 다른 `HERMESTALK_GATEWAYS`로 다른 에이전트가 뜨는지 확인(2번째 PC 필요)

## Phase 3 — 1:1 메신저 UX (요구 3·4 일부)
- [x] unread 뱃지 — `unread-store.ts`(useSyncExternalStore+localStorage, friendlyId→lastReadAt). 세션 `updatedAt`>lastReadAt이면 사이드바에 accent dot+bold. 활성 세션은 effect로 항상 읽음 처리(스트리밍 갱신 무시). 클릭 시 markSessionRead. 텔레그램 응답으로 세션 갱신되면 웹에 unread로 뜸(세션 공유 기반)
- [x] 1:1 real 스트리밍 동작 확인 — 게이트웨이 `/v1/chat/completions` stream SSE 실측(role delta→finish stop→[DONE]). Studio 기본 흐름 그대로 사용(무수정)
  - ⏳ (env) 텔레그램↔웹 세션 연속성은 텔레그램 봇 실사용 필요 — 2번째 환경에서 확인
- [ ] 메시지 검색(`search-modal.tsx`) 메시지 대상으로 확장 — 다음 커밋(slack 벤치 #3, 후순위)

## Phase 4 — 그룹방 위임 (요구 5, 방식 A) ★하이라이트
- [ ] `/chat/$sessionKey`에 group 세션 타입 추가 → 리더 프로필로 라우팅
- [ ] `delegate_task` 위임 이벤트(`/v1/runs/{id}/events`)를 `message-item.tsx` 카드 → **위임 말풍선** 스타일로
- [ ] @mention으로 특정 서브봇 지목(`chat-composer.tsx`)
- [ ] 리더 위임 → 서브봇 진행 → 취합 흐름이 한 화면에 시간순으로 보이는지 확인

## Phase 5 — 네이티브 칸반 전환 (요구 4, 방식 B) [결정 ①]
- [ ] (Phase 1) Studio 자체 보드 그대로 사용 중 → 여기서 데이터 레이어 스왑
- [ ] `task-store.ts`/`tasks-api.ts`를 `/api/plugins/kanban/` 프록시로 교체(UI 유지)
- [ ] 그룹방 위임 작업이 네이티브 칸반에 생성되고 담당 봇이 claim → 두 PC/텔레그램에서 같은 보드 확인
- [ ] (Nice) `/v1/skills`로 스킬 보드 실데이터 확인

## Phase 6 — 실사용 안정화
- [ ] 인증(WebAuthn/패스워드) — 원격/멀티PC 접속 대비 (webui 아이디어)
- [ ] Docker Compose `restart: unless-stopped`로 게이트웨이+Studio 상시 가동
- [ ] 집/회사 양쪽에서 1주일 실사용 → 깨지는 지점 수정
- [ ] 업스트림(Studio) 변경 주기적 머지 절차 점검

---

## 슬랙 벤치마크 — 적용 우선순위
1. @mention 라우팅(그룹방 봇 지목) — Phase 4
2. unread 뱃지/알림(텔레그램 알림과 중복 조율) — Phase 3
3. 메시지 검색 — Phase 3
4. (후순위) pin/star, 슬래시 커맨드(자주 쓰는 프롬프트)

## 리스크
- N에이전트=N게이트웨이 운영 부담 → 자주 쓰는 것만 + 자동 기동으로 완화.
- 포크 업스트림 드리프트 → 변경을 레이어/별도 커밋으로 최소 침습, 주기적 머지.
- 네이티브 칸반 API 형태가 예상과 다르면 → Phase 5 전환 보류, Studio 자체 보드 유지(요구 충족은 1순위 아님).
- delegate_task 이벤트 형태가 다르면 → 위임 시각화는 Studio Conductor 흐름을 참고해 조정.
