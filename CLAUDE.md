# HermesTalk — Claude Code 작업 지침서

> 멀티 에이전트 메신저. 여러 도메인 특화 Hermes 에이전트를 채팅방으로 관리하고,
> 그룹방에서 리더가 서브에이전트에게 위임·취합한다.
> **해커톤은 끝났다. 이건 내가 집/회사 PC에서 실제로 쓰는 셀프호스팅 개인 도구다.**

**작업 순서는 `TODO.md`를 Phase 0부터 따른다.** mock 없음. 처음부터 real 연동 기준으로 만든다.

---

## 0. 핵심 방향 (이전 해커톤 계획과 무엇이 바뀌었나)

이 프로젝트는 **0에서 Next.js로 만들지 않는다.** **Hermes Studio(`JPeetz/Hermes-Studio`, MIT)를 포크**해서, 거기에 **메신저 UX 레이어**만 얹는다. 이유: Studio가 우리가 만들려던 것의 ~90%(게이트웨이 capability 자동 감지, `/v1/runs` 위임 이벤트 스트리밍, tool 카드, 세션관리, 칸반 UI, cron, approvals)를 이미 구현했고, 개인 도구엔 "차별점"보다 **유지보수 부담 최소화**가 중요하기 때문.

| 항목 | 이전(해커톤) | 지금(실사용) |
|---|---|---|
| 베이스 | Next.js 0부터 | **Hermes Studio 포크 (TanStack Start + React)** |
| 동작 | mock 먼저 | **real-first, mock 없음** |
| 에이전트 | `config/agents.ts` 8개 하드코딩 | **런타임 게이트웨이 자동 감지(PC별로 다름)** |
| 칸반 | 로컬 store 전용 | **Hermes 네이티브 칸반(`/api/plugins/kanban/`)으로 전환** |
| 그룹방 | 새 컴포넌트 | **Studio chat 화면 확장**(Conductor는 보조 관제 뷰) |
| 외부 연동 | 없음 | **텔레그램 + 웹 동시**(둘 다 같은 게이트웨이 클라이언트) |

> ⚠️ 기존 루트의 `config/agents.ts`, `.env.example`, `app/` 기반 구조, `mockup.html`은 **from-scratch Next.js 계획의 잔재**다. mockup.html은 이제 "메신저 UX 레이어"의 디자인 참고용으로만 본다(정본 아님). 실제 코드 정본은 포크한 Studio 코드베이스다.

## 1. 목표 (성공 기준 = 실제로 매일 쓸 수 있는가)

1. 집/회사 PC 각각에서, **그 PC에 떠 있는 Hermes 게이트웨이만** 채팅방으로 자동 표시 + presence.
2. 1:1 채팅에서 메시지 → real Hermes 응답 SSE 스트리밍 (텔레그램에서 보내도 같은 세션으로 이어짐).
3. 그룹방에서 리더가 `delegate_task`로 위임하는 과정이 말풍선으로 보이고 최종 취합.
4. 위임된 작업이 Hermes 네이티브 칸반에 떠서 담당 봇이 claim → 두 PC/텔레그램에서 같은 보드를 본다.

## 2. Hermes 멀티에이전트 = 2가지 방식 (반드시 구분)

**방식 A — `delegate_task` (한 게이트웨이 *안*에서 위임).**
- 게이트웨이 1개짜리 에이전트가 자기 프로세스 안에서 일회용 sub-agent를 띄워 병렬 처리 후 취합.
- `config.yaml`: `max_concurrent_children`(기본 3), `max_spawn_depth`(기본 1), `orchestrator_enabled`, role `orchestrator`/`leaf`.
- sub-agent는 부모 대화를 모름(goal/context로 전달), 최종 요약만 반환.
- **그룹방 위임 UX는 이걸 쓴다. 게이트웨이 8개 안 띄워도 됨.**

**방식 B — 공유 칸반 (여러 게이트웨이/프로필 *사이* 협업).**
- 이름 붙은 영속 봇들(각자 게이트웨이 1개)이 `~/.hermes/kanban.db`(SQLite, 프로필 공유)로 협업.
- 디스패처가 담당 프로필을 atomically claim → 게이트웨이 자동 기동 → 처리. 부모-자식 의존성·핸드오프·코멘트 지원.
- 접근 3종: 에이전트 툴(`kanban_create()` 등) / CLI(`hermes kanban`) / **HTTP REST(`/api/plugins/kanban/`)**.

> Studio의 **Conductor = 방식 A**, **Crews = 방식 B(자체 fan-out 구현)**. 우리는 그룹방=방식 A, 칸반=방식 B 네이티브를 쓴다.

## 3. 못 바꾸는 제약: 에이전트 N개 = 게이트웨이 프로세스 N개 (PC당)

- 프로필 1개 = 게이트웨이 1프로세스 + 전용 포트 + (텔레그램 쓰면) 전용 봇 토큰. 단일 게이트웨이 멀티프로필은 [미구현(논의 중)](https://github.com/NousResearch/hermes-agent/issues/23735).
- `model` 필드는 장식용 → 어느 봇과 얘기할지는 **포트(baseUrl)로만** 결정.
- 현실적 운영: 그날 쓸 2~3개만 띄움 + `<프로필> gateway install`로 부팅 시 systemd/launchd 자동 기동.
- **그래서 "PC별 자동 표시"가 자연스럽다** — 그 PC에 떠 있는 게이트웨이만 probe에 잡힌다.

## 4. Hermes 게이트웨이 연동 (사실, Studio 코드로 확인)

- 활성화: Hermes `.env`에 `API_SERVER_ENABLED=true`, `API_SERVER_KEY=<key>`. 베이스 `http://<host>:8642/v1`, 인증 `Authorization: Bearer <key>`.
- **연결 설정**: `HERMES_API_URL`(기본 `127.0.0.1:8642`) + `HERMES_API_TOKEN`. 서버측 프록시(브라우저는 `/api/*`만 호출). → `src/server/hermes-api.ts`, `src/server/gateway-capabilities.ts`.
- **capability 자동 감지**: `probeGateway()`가 `/health`·`/v1/chat/completions`·`/v1/models`·`/api/{sessions,skills,memory,config,jobs}`를 병렬 probe(120s 캐시) → 있는 기능만 켬. → 요구 "PC별 자동 표시"의 토대. (`src/server/gateway-capabilities.ts:168`)
- **위임 스트리밍**: `POST /v1/runs` → `GET /v1/runs/{id}/events`(SSE)에서 토큰 + sub-agent lifecycle. Studio에 프록시 이미 있음 → `src/routes/api/hermes-runs.ts`, `hermes-runs.$runId.events.ts`. `delegate_task` 툴콜은 `👥 Delegate Task` 카드로 렌더(`src/screens/chat/components/message-item.tsx:362`).
- **스킬 조회**: `GET /v1/skills`(또는 `/api/skills`) — capability에 잡히면 사용.
- **칸반**: ❗정정 — **HTTP API 있음**(`/api/plugins/kanban/`, `~/.hermes/kanban.db`). 단 **Studio는 이걸 안 쓰고 자체 `.runtime/tasks.json`에 저장**(`src/server/task-store.ts`). 우리는 데이터 레이어를 네이티브 칸반으로 스왑한다.

## 5. 텔레그램 + 웹 동시 사용

- 텔레그램은 Hermes 네이티브 기능(우리가 코드 안 짬). 게이트웨이 `.env`에서 텔레그램 + API 서버 둘 다 켜면 끝.
- **프로필마다 봇 토큰 1개 + 게이트웨이 1개.** 같은 토큰을 두 게이트웨이에서 쓰면 Telegram이 동시 polling을 거부.
- `~/.hermes/` 세션·메모리 공유 → 텔레그램 대화를 웹에서 이어보기 가능.
- 상시 가동: Docker Compose `restart: unless-stopped` 또는 `<프로필> gateway install`.

## 6. 메신저 UX 레이어 — 끼울 지점 (Studio 포크 위, 최소 침습)

Studio chat 화면은 이미 풍부(세션 사이드바·말풍선·composer·ContextBar 토큰·ApprovalCard·스트리밍·rename/auto-title). 여기에 얹는다:

| 추가 기능 | 끼울 위치 | 비고 |
|---|---|---|
| presence 뱃지 + unread | `src/screens/chat/components/chat-sidebar.tsx` | presence 소스 = `gateway-capabilities` probe |
| 채팅방=에이전트 목록 | `chat-sidebar` + `src/routes/api/agents/` | 세션 목록이 아닌 "에이전트 방" 관점 추가 |
| @mention(서브봇 지목) | `src/screens/chat/components/chat-composer.tsx` | 그룹방에서 특정 봇 타겟 |
| 그룹방(리더 라우팅) | `/chat/$sessionKey` 에 group 세션 타입 | 리더 프로필로 전송 → `/v1/runs` 위임 이벤트 |
| 위임 말풍선 | `src/screens/chat/components/message-item.tsx` | 기존 delegate_task 카드 재스타일 |
| 메시지 검색 | `src/components/search/search-modal.tsx` | 글로벌 검색 이미 있음 → 메시지로 확장 |
| 네비에서 채팅 1급화 | `src/components/workspace-shell.tsx` | Conductor/Crews는 보조 뷰 |

> **Conductor는 그룹방이 아니다.** office view + 워커 카드(픽셀아트)인 **관제 대시보드**(`src/screens/conductor/components/conductor-active.tsx`). 그룹방 메신저 흐름은 chat 화면 확장으로 만들고, Conductor는 "한눈에 보는 관제" 보조 뷰로 남긴다.

## 7. 칸반 전략 (결정 ①)

- **목표 = Hermes 네이티브 칸반(방식 B).** 이유: 집/회사 PC가 각자 자기 Hermes를 갖고, 네이티브 보드는 그 PC의 프로필들이 공유하며 봇이 claim 가능. Studio의 `.runtime/tasks.json`은 봇과 단절돼 있어 "그룹방 위임 → 봇 claim" 비전을 못 살린다.
- **단계적 전환**: Phase 1은 Studio 자체 보드 그대로(빠른 가동) → Phase 2에서 `task-store.ts`/`tasks-api.ts` 데이터 레이어를 `/api/plugins/kanban/` 프록시로 스왑(UI는 유지).

## 8. 작업 규칙

- **단순함 우선 / 최소 침습.** Studio 원본을 크게 갈아엎지 말고 레이어로 얹는다(업스트림 머지 가능성 유지).
- **막히면 우회하지 말고 먼저 보고.**
- 커밋/푸시는 사용자가 요청할 때만.
- 검증: 기능마다 real 게이트웨이로 실제 동작 확인(스크린샷/로그). mock으로 때우지 않는다.

## 9. 참고 프로젝트

- `JPeetz/Hermes-Studio` — **포크 베이스.** TanStack Start, capability 감지, `/v1/runs` 위임, 칸반 UI, cron, approvals, crews/conductor.
- `nesquena/hermes-webui` — Hermes 내부 직접 import(강결합·Python). 코드가 아니라 UX 아이디어만 차용(세션관리·tool카드·토큰/비용 링·메모리 편집·WebAuthn).
- Hermes 공식 문서: [Profiles](https://hermes-agent.nousresearch.com/docs/user-guide/profiles) · [Subagent Delegation](https://hermes-agent.nousresearch.com/docs/user-guide/features/delegation) · [Kanban](https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban) · [Telegram](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/telegram/).
