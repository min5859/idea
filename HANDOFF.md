# HermesTalk — 세션 핸드오프 (Phase 2 UI부터 이어서)

> 새 세션은 **`app/` 디렉터리에서 Claude Code를 열고** 이 문서 + `CLAUDE.md` + `TODO.md` + `PHASE0-VERIFICATION.md`를 먼저 읽어라.
> 핵심: 0부터 만들지 않는다. `app/` = **Hermes Studio v1.20.0 포크**. 거기에 **메신저 UX 레이어**만 얹는다.

## 1. 지금 상태 (커밋 완료)
- `a71a1d3` 문서 포크 방향 정합화 + 옛 코드 `legacy/` 보관
- `e20aad1` **Phase 0 완료** — Hermes api_server 활성화 + 연동 실측 검증
- `01dd2a4` **Phase 1 완료** — Studio v1.20.0 포크를 `app/`로 들임 + 게이트웨이 연결 확인
- `9b1afc4` **Phase 2 백엔드** — 다중 게이트웨이 자동 발견 라우트

브랜치 `hermestalk-init` (로컬 커밋만, 푸시 안 함).

## 2. 환경 사실 (실측, 자세히는 `PHASE0-VERIFICATION.md`)
- 이 PC의 Hermes 프로필 = **`maccoder`**, launchd 상시 가동. 텔레그램 동작.
- **api_server 켜짐**: `~/.hermes/profiles/maccoder/.env`에 `API_SERVER_ENABLED=true` (백업: `.env.bak.hermestalk`). `http://127.0.0.1:8642`, 루프백 무인증.
  - 재시작: `hermes --profile maccoder gateway restart` (foreground `run --replace`는 launchd 락과 충돌하니 쓰지 말 것).
- **위임 모델**: `/v1/runs/{id}/events` SSE = OpenAI Responses 스타일. 위임은 별도 이벤트가 아니라 **`name=="delegate_task"` function_call 아이템**. `orchestrator_enabled: true`.
- **칸반**: 네이티브. 프로필별 `~/.hermes/profiles/maccoder/kanban.db`, `hermes kanban` CLI. REST는 dashboard(:9119) `/api/plugins/kanban/`(세션 토큰). api_server(:8642)엔 칸반 라우트 없음.
- **두 surface**: api_server :8642(앱 주 연동) vs `hermes dashboard` :9119(관리 SPA + 칸반 REST).

## 3. 포크 실행 (app/)
```bash
cd app
corepack prepare pnpm@latest --activate      # pnpm 없으면
pnpm install
pnpm rebuild better-sqlite3 esbuild unrs-resolver   # 네이티브 모듈
HERMES_API_URL=http://127.0.0.1:8642 HERMES_DEFAULT_MODEL=maccoder \
  HERMESTALK_GATEWAYS=http://127.0.0.1:8642 pnpm dev   # :3000
```
- 게이트웨이 기본값이 이미 8642라 로컬은 env 없이도 붙는다.
- ⚠️ **새 서버 라우트(`server.handlers`)를 추가하면 dev 서버를 재시작**해야 등록된다(HMR로 routeTree 타입은 갱신되나 SSR 핸들러는 재시작 필요).
- ⚠️ pnpm 신버전은 `package.json`의 `onlyBuiltDependencies`를 무시 → `app/pnpm-workspace.yaml`의 `allowBuilds`로 처리해 둠.

## 4. 핵심 아키텍처 격차 (반드시 이해하고 시작)
**Studio는 단일 게이트웨이 모델**(`HERMES_API_URL` 1개) + 자체 "crews"(한 게이트웨이를 공유하는 역할 페르소나 Roger 등).
**HermesTalk는 다중 게이트웨이**(에이전트1=게이트웨이1=포트). → Phase 2 UI의 본질 = Studio의 사이드바를 "발견된 게이트웨이=채팅방"으로 바꾸는 것.
- 이미 만든 백엔드: `app/src/routes/api/hermestalk/agents.ts` (GET `/api/hermestalk/agents` → `{agents:[{id,baseUrl,model,online}]}`). 검증됨(candidates:2→online:1).

## 5. 다음 작업 (Phase 2 UI → 6) — 파일 포인터
> 시작 전 Studio UI 아키텍처를 정독: `src/components/workspace-shell.tsx`(셸/네비), `src/screens/chat/`(채팅), `src/stores/`(상태).

- **Phase 2 UI**: `src/screens/chat/components/chat-sidebar.tsx` — Studio 내장 crew 대신 `/api/hermestalk/agents` 결과를 "채팅방"으로 렌더 + presence 뱃지. 디자인 타깃 = 루트 `mockup.html` 채팅 뷰.
- **Phase 3 메신저 UX**: 채팅방 unread, 메시지 검색(`src/components/search/search-modal.tsx`).
- **Phase 4 그룹방 위임** ★: `/chat/$sessionKey`에 group 세션 → 리더 프로필 라우팅. `/v1/runs/{id}/events` 프록시는 이미 있음(`src/routes/api/hermes-runs.$runId.events.ts`). `delegate_task` function_call을 위임 말풍선으로(`src/screens/chat/components/message-item.tsx`, 이미 `👥 Delegate Task` 카드 렌더). @mention은 `chat-composer.tsx`.
  - 주의: Conductor(`src/screens/conductor/`)는 office-view **관제 대시보드**라 그룹방이 아님. 그룹방은 chat 확장으로.
- **Phase 5 네이티브 칸반**: Studio 자체 보드(`src/server/task-store.ts` = `.runtime/tasks.json`)를 **dashboard(:9119) `/api/plugins/kanban/`** 프록시로 스왑(UI 유지). `src/lib/tasks-api.ts`.
- **Phase 6 안정화**: 인증(`HERMES_PASSWORD`/WebAuthn, `src/server/auth-middleware.ts`), Docker `restart: unless-stopped`, 양 PC 실사용.

## 6. 원칙
- **최소 침습**: Studio 원본 크게 갈아엎지 말고 레이어/별도 커밋. 업스트림 머지 여지 유지.
- 각 Phase/논리단위마다 커밋. 커밋 메시지 trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- real로 실제 동작 검증(mock 때우기 금지). 커밋은 사용자 요청 시.
- bkit 훅: `$(cmd <<EOF)` heredoc 차단 → 커밋 메시지는 파일로 작성 후 `git commit -F`.
