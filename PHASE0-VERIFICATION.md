# Phase 0 — Hermes 환경 검증 결과 (실측 완료)

> 이 PC(맥)의 실제 Hermes에 붙여 확인한 사실. 추측 아님. 검증일 기준 프로필 = `maccoder`.

## 결론: 웹앱 연동 준비 완료 ✅
api_server를 켜서 `http://127.0.0.1:8642`가 열렸고, 채팅·위임·작업 API가 모두 동작 확인됨.

## 1. Hermes 가동 형태
- 프로필 **`maccoder`** 1개가 **launchd 서비스**로 상시 가동(`ai.hermes.gateway-maccoder`). 죽으면 자동 재기동.
- 재시작: `hermes --profile maccoder gateway restart` (foreground `gateway run --replace`는 launchd 락과 충돌 → restart 써야 함).
- 텔레그램은 outbound polling이라 포트 없이 동작(그래서 api_server 꺼져 있어도 텔레그램은 됐던 것).

## 2. api_server 활성화 (이번에 한 것)
- **프로필 전용 `.env`** = `~/.hermes/profiles/maccoder/.env` 에 `API_SERVER_ENABLED=true` 추가.
  - ⚠️ 글로벌 `~/.hermes/.env`가 아니라 **프로필 .env**가 정답(글로벌 편집은 무시됨).
- 재시작 후 로그: `Gateway running with 2 platform(s)` (telegram + api_server), `API server listening on http://127.0.0.1:8642 (model: maccoder)`.
- 루프백(127.0.0.1) 바인딩이라 **로컬은 인증 키 불필요**. 네트워크 노출(다른 PC 접속) 시 `API_SERVER_KEY` + `API_SERVER_HOST=0.0.0.0` 필요.
- 백업/되돌리기: `~/.hermes/profiles/maccoder/.env.bak.hermestalk`.

## 3. 검증된 엔드포인트 (소스 `gateway/platforms/api_server.py` + 실호출)
- `GET  /v1/models` → `{"data":[{"id":"maccoder",...}]}` (✅ 실호출 확인)
- `GET  /v1/capabilities`, `GET /health`, `/v1/health`
- `POST /v1/chat/completions` (OpenAI 호환 채팅)
- `POST /v1/responses`, `GET/DELETE /v1/responses/{id}`
- **`POST /v1/runs` · `GET /v1/runs/{id}` · `GET /v1/runs/{id}/events`(SSE) · `POST /v1/runs/{id}/stop`** ← 스트리밍/위임 surface
- `GET/POST/PATCH/DELETE /api/jobs` (+`/pause`,`/resume`,`/run`) ← cron jobs (Studio Conductor가 쓰는 그 API)

## 4. 위임(delegate_task) 이벤트 모델 — 그룹방 시각화의 핵심
`/v1/runs/{id}/events`는 **OpenAI Responses 스타일** SSE를 낸다:
- `response.created` / `response.output_text.delta`·`done` / `response.completed` / `response.failed`
- 도구 호출 = `response.output_item.added`·`done` 의 `item.type == "function_call"`, 결과 = `function_call_output`
- **위임은 별도 이벤트 타입이 아니라 `name == "delegate_task"` 인 function_call 아이템으로 나타남.**
  → 그룹방 위임 말풍선 = 이 function_call(delegate_task)을 파싱해 렌더. (Studio가 tool 카드로 처리하는 방식과 동일)
- `config.yaml`에 `orchestrator_enabled: true` 확인됨 → delegate_task 사용 가능.

## 5. 네이티브 칸반
- DB는 **프로필별**: `~/.hermes/profiles/maccoder/kanban.db`. 현재 task 0개(`hermes kanban list` → no matching tasks).
- 접근: `hermes kanban {init,create,claim,dispatch,daemon,...}` CLI 확인됨. REST는 **dashboard(:9119) `/api/plugins/kanban/`** 쪽(세션 토큰 게이트). api_server(:8642)엔 칸반 라우트 없음.

## 6. 두 개의 HTTP surface (혼동 주의)
| | api_server :8642 | dashboard :9119 |
|---|---|---|
| 띄우는 법 | 프로필 .env `API_SERVER_ENABLED=true` + gateway restart | `hermes dashboard` |
| 인증 | 루프백 무인증(또는 `API_SERVER_KEY`) | 세션 토큰(HTML에 주입) |
| 용도 | **앱 주 연동**: 채팅·runs·jobs | 관리 SPA(config/keys/sessions) + 칸반 REST |
| Studio 기대값 | ✅ 이쪽(기본 8642) | — |

→ 우리 앱(Studio 포크)은 **8642 api_server**가 주 연동. 칸반은 CLI/DB 또는 9119 REST 활용 검토.

## 다음(Phase 1) 진입 조건 충족
8642가 떠 있으므로 Studio 포크를 띄워 `HERMES_API_URL=http://127.0.0.1:8642`로 붙이면 됨.
