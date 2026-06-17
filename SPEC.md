# Hermes Crew — 구현 계약 (SPEC)

> CLAUDE.md 가 "무엇을·왜·어떤 순서로", **이 문서가 "정확히 어떤 인터페이스로"** 를 정의한다.
> Claude Code 는 이 SPEC + 채워진 `.env` / `agents.config.json` 으로 바로 구현을 시작할 수 있다.

## 0. ⚠️ 미확정 · 당일 검증 항목 (가정하지 말 것)

- **delegate_task 의 API 경유 트리거**: 리더(orchestrator) 프로필에 일반 메시지를 보내면 내부 위임이 일어나는 게 설계 의도지만, **API 경유로 실제 작동하는지는 공식 문서에 미명시**. 당일 검증. 안 되면 오케스트레이션은 발표 언급만(스트레치).
- **kanban.db 스키마**: 경로는 `~/.hermes/profiles/<name>/kanban.db` 로 추정되나 테이블 구조 미상 → 작업(task) 보드는 스트레치.
- **스킬/툴 on/off 반영 시점**: `hermes skills config` / `hermes tools enable|disable` 변경은 **다음 세션(/reset)부터 적용**(mid-conversation 즉시 반영 아님). UI 에 반드시 표기.
- **CORS**: API 서버는 조건부 CORS (`API_SERVER_CORS_ORIGINS`). 기본 차단 → **백엔드 프록시(server-to-server)로 우회**하는 게 기본 설계. 프론트 직접 호출은 데모 한정 폴백.
- **세션 export 의 프로필 스코핑·날짜 필터**: 주간보고 입력원은 `hermes -p <profile> sessions export`(JSONL) 다(§7). `-p` 가 프로필별 `state.db` 로 정확히 스코핑되는지, 이번 주 필터를 세션 ID(`YYYYMMDD` prefix)로 거는 방식이 맞는지 당일 확인. (`sessions list` 에 `--since` 없음 → ID prefix 로 클라이언트 측 필터)

## 1. 프로젝트 구조

```
hermes-crew/
├── frontend/
│   ├── index.html        # mockup.html 을 확장 (마크업/스타일 재사용)
│   ├── app.js            # 상태·렌더·API 호출
│   └── styles.css        # mockup 의 <style> 분리
├── backend/
│   └── server.py         # FastAPI 권장 — 프록시 + hermes CLI 조회
├── agents.config.json    # ← 환경: 프로필↔포트↔표시명 (.example 복사해 채움)
├── .env                  # ← 환경: API_SERVER_KEY 등 (.example 복사해 채움)
└── .gitignore
```

- 프론트는 **백엔드가 정적 서빙**(동일 출처) → CORS 불필요.
- 언어: 백엔드 **Python + FastAPI** 권장(= hermes CLI subprocess 호출이 자연스러움). uvicorn 단일 프로세스.

## 2. 환경 정보 (사용자가 채우는 빈칸)

`.env.example`, `agents.config.example.json` 참조. 사용자는 이 두 파일을 복사해 사내 실제값(서버 IP·API 키·프로필명·포트)만 채운다.

## 3. Hermes API 호출 규격 (채팅)

- **Base URL**: `http://<HERMES_HOST>:<port>/v1` (port 는 프로필마다 다름 → agents.config.json)
- **인증**: 모든 요청에 헤더 `Authorization: Bearer <API_SERVER_KEY>`
- **채팅**: `POST /v1/chat/completions`
  ```jsonc
  {
    "model": "<프로필명>",      // 그 포트가 광고하는 model 명
    "messages": [ ... ],        // 클라이언트가 누적 전송 (서버는 stateless)
    "stream": true
  }
  ```
  - 추가 헤더 `X-Hermes-Session-Key: <프로필명>` 고정 → **프로필별 장기 메모리 연속**.
  - `stream:true` → **SSE**. 각 `data:` 라인은 `chat.completion.chunk` (`choices[0].delta.content` 누적). 커스텀 이벤트 `hermes.tool.progress` 는 도구/위임 진행 표시용(옵션 → delegation 카드).
  - 종료 신호: `data: [DONE]`
- **모델 확인**: `GET /v1/models` → **그 포트의 단일 프로필만** 광고 (전체 목록 자동발견 아님).
- **상태 확인**: `GET /health` (해당 포트가 살아있는지).

## 4. 멀티 에이전트 = 프로필별 포트 (자동발견 ❌)

- 포트 동적 레지스트리 없음. 프론트는 **`agents.config.json` 매핑**으로 각 endpoint 를 안다.
- **동시 독립 대화** = 프로필마다 ① 독립 `messages` 배열(프론트 보관) ② 독립 endpoint 로 병렬 `fetch`.

## 5. 백엔드 래퍼 (필수) — `server.py` 엔드포인트 계약

| 메서드 · 경로 | 동작 |
|---|---|
| `GET /api/agents` | `agents.config.json` + 각 프로필 상태(살아있음/모델명)를 합쳐 반환 |
| `POST /api/chat/{profile}` | 해당 프로필 `/v1/chat/completions` 로 **프록시**(키 주입, SSE 패스스루). body=`{messages}` |
| `GET /api/agents/{profile}/skills` | `hermes -p <profile> skills list` + `tools list` 파싱 → `[{name, enabled}]` |
| `POST /api/agents/{profile}/skills/{name}/toggle` | `hermes -p <profile> skills config …` (⚠️ 다음 세션 적용) |
| `POST /api/report` | 각 프로필 `sessions export`(이번 주 필터) 집계 → report(또는 lead) 프로필에 고정 프롬프트 → 마크다운 주간보고 반환 (§7) |
| `GET /` (정적) | `frontend/` 서빙 |

- **API 키는 백엔드 `.env` 에만.** 프론트로 절대 내려보내지 않는다.
- 상태 판정: `GET http://<HERMES_HOST>:<port>/health` 또는 `hermes -p <p> gateway status`.

## 6. 서버 환경 셋업 (1회, 사람이 수행)

각 프로필 `~/.hermes/profiles/<name>/.env`:
```
API_SERVER_ENABLED=true
API_SERVER_KEY=<공통키>
API_SERVER_HOST=0.0.0.0
API_SERVER_PORT=<프로필 고유 포트>   # driver=8642, reviewer=8643, ...
```
기동(각 프로필마다, gateway 명령이 API 서버 포함):
```
hermes -p driver   gateway &
hermes -p reviewer gateway &
hermes -p report   gateway &
```
검증: `curl http://<IP>:8642/v1/models -H "Authorization: Bearer <key>"`

## 7. 주간보고 (`POST /api/report`)

- **입력원 = 프로필별 세션 export(권장).** Hermes 는 프로필별 `state.db`(`~/.hermes/profiles/<name>/`, SQLite)에 전체 대화(메시지·role·tool call·타임스탬프)를 저장한다. 세션 ID 가 `YYYYMMDD_HHMMSS_<hex>` 포맷이라 **날짜로 슬라이싱**되고, 웹 UI 채팅도 API 서버 경유라 세션으로 적재된다. → report 프로필이 남의 메모리를 못 읽는 문제를 백엔드 집계로 우회한다.
- 집계 절차(백엔드):
  1. 각 프로필 `hermes -p <profile> sessions list --limit N` → 이번 주(세션 ID 의 `YYYYMMDD` prefix)만 필터.
  2. `hermes -p <profile> sessions export <tmp>.jsonl`(개별은 `--session-id`) → JSONL 읽어 파싱.
  3. 전 프로필 transcript 를 합쳐 report(또는 lead) 프로필에 고정 프롬프트로 1회 호출.
- 고정 프롬프트:
  > "각 직무 에이전트의 이번 주 작업을 **완료 / 진행 중 / Blocker** 로 분류해 마크다운 주간보고로 작성하라. 각 항목 앞에 `[프로필명]` 표기."
- ⚠️ `sessions export` 는 stdout 이 아니라 **파일(JSONL)** 출력 → temp 파일 경유 후 파싱. `-p` 스코핑·날짜 필터는 §0 당일 검증.
- 폴백: export 가 막히면 세션 로그 수동 첨부 요약.

## 8. 스킬 보드 데이터

- 조회: `hermes -p <p> skills list` (+ `hermes -p <p> tools list`) → `enabled` 플래그 파싱.
- 토글: `hermes -p <p> skills config` / `hermes -p <p> tools enable|disable <name>`.
- **UI 고지 필수**: "변경은 다음 세션부터 적용됩니다".

## 9. mockup.html → 실구현 매핑

| mockup 의 더미 | 실구현 |
|---|---|
| `AGENTS` 하드코딩 배열 | `GET /api/agents` 결과로 로딩 |
| `send()` 의 `setTimeout` 에코 | `POST /api/chat/{profile}` + SSE 파싱하여 버블에 토큰 누적 |
| `renderBoard()` 더미 skills | `GET /api/agents/{profile}/skills` 결과 |
| 주간보고 모달 고정 텍스트 | `POST /api/report` 결과 마크다운 렌더 |
| delegation 카드(`__deleg`) | 리더 응답 스트림의 `hermes.tool.progress` 이벤트(가능 시) |
