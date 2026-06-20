# HermesTalk — TODO (실사용 개인 도구)

목표: **Hermes Studio를 포크**해서, 집/회사 PC에서 실제로 쓰는 멀티에이전트 메신저로 만든다.
원칙: **real-first(mock 없음) · 최소 침습(Studio 레이어로 얹기) · 막히면 보고.**
핵심 순위: ①PC별 에이전트 자동표시 → ②1:1 real 스트리밍 → ③그룹방 위임 → ④네이티브 칸반.

> 자세한 결정·근거·코드 위치는 `CLAUDE.md` 참조.

---

## Phase 0 — Hermes 환경 + 사실 검증 (착수 전 필수)
- [ ] 실사용 프로필 선정(예: 드라이버봇·디버그봇·리뷰봇·팀리더봇). **N개 = 게이트웨이 N개** 인지
- [ ] 각 프로필 게이트웨이를 `API_SERVER_ENABLED=true` + `API_SERVER_KEY`로 기동, 포트 정리(8642, 8643…)
- [ ] `<프로필> gateway install`로 부팅 시 자동 기동 등록(systemd/launchd) 확인
- [ ] 텔레그램: 프로필별 봇 토큰 발급(BotFather) + `.env` 기입, 1:1 DM 동작 확인 (웹과 세션 공유되는지)
- [ ] `POST /v1/runs` → `GET /v1/runs/{id}/events` SSE로 **delegate_task 위임(lifecycle) 이벤트**가 실제로 오는지 raw 확인
- [ ] 네이티브 칸반 `/api/plugins/kanban/` 응답 형태 확인 (읽기/생성/이동) — Phase 5 전환의 근거
- [ ] `delegate_task` 동작 확인: `config.yaml`에 `max_concurrent_children`/`max_spawn_depth`/`orchestrator_enabled`

## Phase 1 — Studio 포크 셋업
- [ ] `JPeetz/Hermes-Studio` 포크 + 클론, `npm install`, `HERMES_API_URL`/`HERMES_API_TOKEN` 설정 후 `npm run dev` 기동
- [ ] 우리 Hermes 게이트웨이에 붙여 1:1 채팅·세션·스킬·칸반(자체) 기본 동작 확인
- [ ] 포크 운영 방침 결정: 업스트림 추적 브랜치 + 우리 변경은 별도 커밋/레이어로(머지 충돌 최소화)
- [x] from-scratch 잔재 코드 `legacy/`로 이동 보관 완료(`agents.ts`·`skills.ts`·`types.ts`, 코드 정본은 포크라 미사용)
- [ ] **mockup.html 재작도 결정**: 지금은 "메신저 UX 레이어 디자인 타깃"으로 역할만 재정의 + 틀린 사실 수정 완료. 전면 재작도는 **포크를 띄워 Studio 실제 화면을 본 뒤**, 그 위에 얹을 부분(채팅방=에이전트·presence·위임 말풍선·@mention)만 Studio 화면 기준으로 다시 그린다 (지금 추측으로 전면 재작도하지 않음)

## Phase 2 — PC별 에이전트 자동 표시 (요구 2)
- [ ] 후보 게이트웨이 목록을 PC 로컬 설정(`.env`/config)으로: 포트/baseUrl 나열
- [ ] `gateway-capabilities.probeGateway()`로 살아있는 게이트웨이만 감지 → "채팅방=에이전트" 목록 생성
- [ ] `chat-sidebar.tsx`에 presence 뱃지(온라인/유휴/오프라인) 연결
- [ ] 집/회사 PC에서 각각 다른 에이전트가 뜨는지 확인

## Phase 3 — 1:1 메신저 UX (요구 3·4 일부)
- [ ] 채팅방(에이전트) 관점으로 사이드바 정리 + unread 카운트
- [ ] 1:1 real 스트리밍 동작 확인(Studio 기본 흐름 활용), 텔레그램↔웹 세션 연속성 확인
- [ ] 메시지 검색(`search-modal.tsx`) 메시지 대상으로 확장

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
