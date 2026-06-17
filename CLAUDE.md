# HermesTalk — Claude Code 작업 지침서

> 멀티 에이전트 메신저. 여러 도메인 특화 Hermes 에이전트를 채팅방으로 관리하고,
> 그룹방에서 리더 에이전트가 서브 에이전트에게 위임·취합한다. 해커톤 1일 MVP.

**작업 순서는 `TODO.md`를 Phase 0부터 따른다. UI·mock 데이터는 `mockup.html`이 정본.** 기본 `HERMES_MODE=mock`으로 먼저 끝까지 동작시킨 뒤 real 연동.

## 목표 (성공 기준)

데모에서 다음 3개가 **실제로 동작**하면 성공:
1. 채팅방 목록에 특화 에이전트들이 뜨고 presence 뱃지 표시.
2. 1:1 채팅에서 메시지 → Hermes 응답이 SSE로 스트리밍.
3. 그룹방에서 리더가 서브 에이전트에게 위임하는 과정이 말풍선으로 보이고 최종 취합 답변.

## 기술 스택 (확정 — 논의로 시간 쓰지 말 것)

- **Next.js 15 (App Router) + TypeScript** — UI와 프록시 API를 한 앱에서.
- **Tailwind CSS** — 빠른 메신저 UI.
- **스트리밍** — 채팅은 body 있는 **POST**이므로 `fetch` + `ReadableStream`으로 SSE를 읽는다. (`EventSource`는 GET 전용이라 부적합)
- 상태: React 로컬 상태 + 간단한 store(zustand 정도). 무거운 것 금지.
- 에이전트 레지스트리: `config/agents.ts` (코드 상수). DB 없음.
- **UI·mock 데이터 정본: `mockup.html`.** 레이아웃·말풍선 스타일·그룹방 위임 시퀀스(CONVOS)·스킬/칸반 데이터가 다 들어 있다. 0에서 다시 디자인하지 말고 이걸 옮긴다.

## 아키텍처

```
app/
  page.tsx                  # 셸 (좌측 레일: 채팅/스킬/칸반 + 뷰 전환)
  api/agents/route.ts       # GET: 에이전트 레지스트리 + presence
  api/chat/[agentId]/route.ts # POST: 메시지 → Hermes 어댑터 → SSE 스트리밍
  api/skills/route.ts       # GET: 에이전트별 skill 목록 (API 우선, 없으면 config)
  api/tasks/route.ts        # GET/POST/PATCH: 칸반 작업 (로컬 store, write-back 옵션)
components/
  NavRail.tsx               # 좌측 레일: 💬 채팅 / 🗂 스킬 / 📋 칸반 전환
  ChatList.tsx              # 채팅방 목록 + presence 뱃지
  ChatView.tsx              # 말풍선 + 입력창 + 스트리밍
  DelegationBubble.tsx      # 그룹방: 서브에이전트 위임 카드 → 말풍선
  SkillBoard.tsx            # 열=에이전트, 카드=skill (read-only)
  KanbanBoard.tsx           # Backlog/ToDo/InProgress/Review/Done, 드래그·claim
lib/
  hermes/adapter.ts         # Hermes 연동 인터페이스 (real | mock 토글)
  hermes/real.ts            # 실제 Hermes chat API 호출
  hermes/mock.ts            # 폴백용 모의 스트리밍(데모 안전망)
  store/tasks.ts            # 칸반 상태 (zustand, 로컬 우선)
config/agents.ts           # 특화 에이전트 정의
config/skills.ts           # 에이전트별 skill 하드코딩 폴백
```

### Hermes 연동 = 내장 API 서버 (SSH·게이트웨이 아님)

Hermes는 **OpenAI 호환 API 서버**를 내장한다. 이걸 호출한다. (아래는 소스 `gateway/platforms/api_server.py`로 확인된 사실)
- 활성화: Hermes `.env`에 `API_SERVER_ENABLED=true`, `API_SERVER_KEY=<key>`. 베이스 `http://<host>:8642/v1`, 인증 `Authorization: Bearer <key>`.
- **⚠️ 프로필 = 게이트웨이 = 포트.** `/v1/chat/completions`의 `model` 필드는 **장식용**이라 요청별 프로필 선택이 안 된다. 프로필(특화 에이전트) 1개당 게이트웨이 프로세스 1개를 별도 포트로 띄워야 한다. → real로 8개를 다 띄우는 건 비현실적. **real은 1~2개만(예: 디버그봇), 나머지는 mock.**
- **스트리밍·위임은 Runs API로.** `POST /v1/runs` → `run_id` 수신 → `GET /v1/runs/{run_id}/events`(SSE)에서 토큰 + **sub-agent 위임(lifecycle) 이벤트**를 받는다. (`/v1/chat/completions` 스트림엔 `hermes.tool.progress` 정도만)
- **스킬 조회**: `GET /v1/skills` 존재(게이트웨이별). (+ `/v1/toolsets`, `/v1/capabilities`)
- **Kanban**: API 서버에 엔드포인트 **없음**. 칸반은 로컬 store 전용.

### Hermes 어댑터 (가장 중요 — 여기서 막히면 전부 막힘)

- 인터페이스: `chat(agentId: string, messages: Msg[]): AsyncIterable<HermesEvent>` (`Msg = {role:'user'|'agent', text:string}`)
- `HermesEvent` = `{type:'token', text}` | `{type:'delegation', agent, status}` | `{type:'done'}`
- 환경변수 `HERMES_MODE=real|mock` 로 전환. **mock이 기본값**(앱이 항상 켜지도록).
- `real.ts`: `agentId` → 해당 게이트웨이 `baseUrl`(`config/agents.ts`) 결정 → `POST /v1/runs`로 run 시작 → `GET /v1/runs/{run_id}/events` SSE 구독 → 토큰/위임 이벤트를 `HermesEvent`로 변환.
- 위임 이벤트의 sub-agent 이름이 우리 레지스트리 `id`와 다를 수 있음 → 매핑 실패 시 기본 아이콘으로 폴백.

### 스킬 보드 (read-only)

- 데이터 전략: **API 우선, 없으면 하드코딩.** 가동 중인 게이트웨이는 `GET /v1/skills`로 조회해 `api/skills`가 프록시, 미가동(mock) 에이전트는 `config/skills.ts` 폴백.
- UI: 열=에이전트, 카드=skill(이름+1줄 설명). 클릭/토글 없음(읽기 전용). 단순하게.

### 작업 칸반 (드래그·claim — 풀기능)

- **상태는 로컬 store(zustand)가 SoT.** 드래그·claim·레인 이동은 전부 로컬에서 즉시 동작 → 데모가 API에 묶이지 않음.
- 레인: Backlog / To Do / In Progress / Review / Done. 카드 = 작업(제목, 담당 에이전트, 상태).
- **그룹방 연동**: 리더가 위임하면 해당 작업이 칸반 카드로 생성되고 담당 봇이 자동 claim → In Progress로 이동 (그룹방 ↔ 칸반이 같은 store 공유).
- **API 서버엔 Kanban 엔드포인트가 없음(소스 확인).** 칸반은 **로컬 store 전용으로 확정** — write-back은 범위 밖.

## 에이전트 = Hermes 프로필

특화 에이전트 1개 = Hermes 프로필 1개 = **전용 게이트웨이 1개(별도 포트)**. real로 띄운 것만 `live:true`+`baseUrl`을 채우고, 나머지는 mock으로 둔다.
`config/agents.ts` 예시 형태:

```ts
// live:true = 전용 게이트웨이가 떠 있어 real 호출. 나머지는 mock.
export const AGENTS = [
  { id:'debug',   name:'디버그봇',   emoji:'🐞', isLeader:false, live:true,  baseUrl:'http://<host>:8642/v1' },
  { id:'leader',  name:'팀리더봇',   emoji:'👑', isLeader:true,  live:false, baseUrl:'http://<host>:8643/v1' },
  { id:'driver',  name:'드라이버봇', emoji:'🐧', isLeader:false, live:false },
  { id:'design',  name:'설계봇',     emoji:'📐', isLeader:false, live:false },
  { id:'impl',    name:'구현봇',     emoji:'⌨️', isLeader:false, live:false },
  { id:'review',  name:'리뷰봇',     emoji:'🔍', isLeader:false, live:false },
  { id:'report',  name:'주간보고봇', emoji:'📊', isLeader:false, live:false },
  { id:'deck',    name:'발표봇',     emoji:'🎤', isLeader:false, live:false },
] as const
```

### 그룹방 오케스트레이션

- 그룹방 = 리더 에이전트(`isLeader:true`)에게 메시지를 보냄.
- 리더 게이트웨이가 Hermes sub-agent 기능으로 위임 → `GET /v1/runs/{id}/events`의 lifecycle 이벤트를 어댑터가 `delegation`으로 변환.
- 프론트는 `delegation` 이벤트를 받으면 해당 서브에이전트 아바타로 "입력 중…" → 결과 말풍선 렌더.
- **우리가 위임 로직을 새로 짜지 않는다.** Hermes가 위임을 수행하고, 우리는 그 이벤트를 UI로 보여준다.

## 작업 규칙

- **단순함 우선**: 200줄로 될 걸 50줄로. 추상화·라이브러리 남발 금지.
- **Phase 0(Hermes API 검증)을 반드시 먼저.** 막히면 즉시 알리고 mock으로 UI부터 완성(데모는 mock로도 돌아가야 함).
- 데모 시나리오를 깨는 변경은 하지 않는다. **메신저 3기능(①②③) 안정화가 보드(④⑤)보다 우선.** 보드 때문에 메신저가 미완되면 안 됨.
- 커밋/푸시는 사용자가 요청할 때만.
- 막히면 우회하지 말고 먼저 보고.

## 데모 시나리오 (이게 깨지면 안 됨)

1. 채팅방 목록 → presence 뱃지.
2. 디버그봇 1:1 → 스트리밍 응답.
3. 그룹방 → "패치 리뷰하고 주간보고 반영" → 리뷰봇·주간보고봇 위임 말풍선 → 리더 취합.
4. 🗂 스킬 보드 탭 → 에이전트별 skill 한눈에.
5. 📋 칸반 탭 → 위에서 위임된 작업이 카드로 생성되어 레인 이동 / 드래그.

## 실행

```bash
npm install
HERMES_MODE=mock npm run dev   # 데모 안전망(항상 동작)
HERMES_MODE=real npm run dev    # 실제 Hermes 연동(Phase 0 검증 후)
```
