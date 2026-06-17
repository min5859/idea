# HermesTalk — 해커톤 TODO (1일 MVP)

목표: 데모 핵심 — ①채팅방+presence ②1:1 SSE 스트리밍 ③그룹방 위임 시각화 (+ ④스킬 보드 ⑤작업 칸반).
원칙: **mock 먼저 끝까지 → real 연동 → 안정화.** 막히면 즉시 보고하고 mock으로 데모 보장.
순위: 메신저 3기능(①②③)이 1순위. 보드(④⑤)는 그 다음. 칸반 write-back 실연동은 맨 마지막.

---

## Phase 0 — Hermes API 검증 (착수 전 필수, ~30분)
- [ ] real로 띄울 프로필 1~2개 선정(예: 디버그봇). **프로필=게이트웨이=포트**라 다 띄울 필요 없음
- [ ] 그 프로필 게이트웨이를 `API_SERVER_ENABLED=true`+`API_SERVER_KEY`로 기동, baseUrl을 `config/agents.ts`에 기입
- [ ] `POST /v1/runs` → `run_id` → `GET /v1/runs/{run_id}/events`(SSE) 토큰+위임 이벤트 형태 확인
- [ ] `GET /v1/skills` 응답 형태 확인 (스킬 보드 real 소스)
- [ ] (확정 사실) Kanban HTTP API 없음 → 칸반은 로컬 store 전용. `model` 필드는 장식용(프로필 선택 불가)
- [ ] ❗막히면: real 보류, mock/로컬로 UI 완성 후 재시도

## Phase 1 — 프로젝트 셋업 (~30분)
- [ ] ⚠️ 폴더에 이미 파일들(CLAUDE.md, config/, lib/, mockup.html…)이 있어 `create-next-app .`이 "디렉터리 비어있지 않음"으로 거부됨 → **임시 폴더에 스캐폴드 후 생성물을 현재 폴더로 병합**(기존 config/·lib/·*.md·mockup.html·.env.example 유지). `tsconfig.json`의 `@/*` 별칭이 루트를 가리키게(`src/` 미사용) 확인
- [ ] `create-next-app` (TS + Tailwind + App Router)
- [ ] zustand 설치, 기본 폴더 구조 생성
- [ ] `config/agents.ts` 에 8개 에이전트 정의
- [ ] `config/skills.ts` 에 에이전트별 skill 목록(폴백) 정의
- [ ] `NavRail` — 좌측 레일(💬 채팅 / 🗂 스킬 / 📋 칸반) + 뷰 전환
- [ ] `HERMES_MODE` 환경변수 처리 (기본 mock)

## Phase 2 — Hermes 어댑터 (~1시간)
- [ ] `lib/hermes/adapter.ts` 인터페이스 + 이벤트 타입 정의
- [ ] `lib/hermes/mock.ts` — 토큰/위임/done 이벤트 모의 스트리밍 (데모 안전망)
- [ ] `api/chat/[agentId]/route.ts` — POST → 어댑터 → SSE 응답
- [ ] `api/agents/route.ts` — 레지스트리 + presence 반환

## Phase 3 — 메신저 UI (~2시간)
- [ ] `ChatList` — 채팅방 목록 + presence 뱃지 (성공 기준 ①)
- [ ] `ChatView` — 말풍선 + 입력창 + EventSource 스트리밍 (성공 기준 ②)
- [ ] 보낸/받은 말풍선 스타일, 자동 스크롤, "입력 중…" 인디케이터

## Phase 4 — 그룹방 오케스트레이션 (~1.5시간) ★데모 하이라이트
- [ ] 그룹방 라우팅 (리더 에이전트로 전송)
- [ ] `DelegationBubble` — `delegation` 이벤트 → 서브에이전트 아바타 + 상태 말풍선
- [ ] 위임 진행 → 결과 → 리더 취합 흐름 렌더 (성공 기준 ③)
- [ ] mock에서 리뷰봇→주간보고봇 위임 시나리오 하드코딩(데모 재현용)

## Phase 5 — 스킬 보드 & 작업 칸반 (~2시간)
- [ ] `api/skills/route.ts` — API 우선, 없으면 `config/skills.ts` 반환
- [ ] `SkillBoard` — 열=에이전트, 카드=skill (read-only) (성공 기준 ④)
- [ ] `lib/store/tasks.ts` (zustand) + `api/tasks/route.ts`
- [ ] `KanbanBoard` — 5레인 + 드래그 이동 + 에이전트 claim (성공 기준 ⑤)
- [ ] 그룹방 위임 → 칸반 카드 자동 생성·claim (같은 store 공유)

## Phase 6 — real 연동 & 안정화 (~1시간)
- [ ] `lib/hermes/real.ts` 채우기 (Phase 0 결과 기반)
- [ ] `HERMES_MODE=real` 로 1:1 동작 확인
- [ ] 그룹방 위임 real 동작 확인 (안 되면 mock 유지, 1:1만 real)
- [ ] (Nice) real 에이전트 1~2개로 1:1 + 스킬보드(`/v1/skills`) 실연동 확인
- [ ] 데모 시나리오 3회 리허설, 깨지는 지점 수정

## Phase 7 — 발표 준비 (~30분)
- [ ] `기획안.md` 기반 슬라이드/말하기 흐름 정리
- [ ] 데모 환경 고정(브라우저 탭, 창 크기, 폰트)
- [ ] 백업: mock 모드로도 데모 가능한지 최종 확인

---

## 시간이 부족하면 버리는 순서
1. 스킬 보드 `/v1/skills` 연동 (config 하드코딩으로 데모)
2. 토큰/큐 미니 대시보드
3. real 그룹방 (1:1만 real, 그룹방은 mock 데모)
→ **절대 못 버리는 것: 채팅방 목록 + 1:1 스트리밍 + 그룹방 위임 시각화(mock 포함)**

## 리스크
- 프로필=포트라 real 멀티에이전트는 게이트웨이 여러 개 필요 → real은 1~2개만, 나머지 mock으로 데모.
- 위임 이벤트(`/v1/runs/.../events`) 형태가 예상과 다르면 → 그룹방은 mock 데모로 차별점만 보여주고 "real은 로드맵" 처리.
- 스코프 팽창(보드 2종 추가) → 메신저 3기능 먼저 완성 후 보드 착수. 보드 때문에 메신저가 미완되면 안 됨.
- Kanban API 없음(확정) → 칸반은 로컬 store 전용으로 데모 완결.
