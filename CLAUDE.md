# Hermes Crew — 해커톤 작업 지침 (Claude Code용)

> 이 파일은 Claude Code 와 함께 작업할 때의 지침서입니다.
> 해커톤 기간(1~2일) 동안 이 문서를 기준으로 작업합니다.

## 한 줄 컨셉

SSH 터미널에 갇힌 1인용 Hermes 를, **사내망 웹에서 여러 직무 특화 에이전트와 동시에 대화하고 리더가 지휘하며 주간보고까지 자동 생성**하는 멀티 에이전트 워크스페이스로 개조한다.

## 배경 / 문제

- 회사 리눅스 서버에 Hermes Agent 를 설치해 쓰는데, 사내 정책상 Telegram/Slack 등 메신저 게이트웨이를 못 쓴다.
- 그래서 매번 윈도우 PC → SSH → 리눅스 서버 → `hermes` 커맨드 → 터미널 채팅, 으로만 써야 한다. 불편하다.
- AI 에이전트를 여러 개 동시에 돌리다 보니 컨텍스트 스위칭이 잦고, 어떤 에이전트가 무슨 작업을 하는지 추적이 어렵다.
- 주간보고를 사람이 손으로 정리하는 게 너무 귀찮고 시간이 든다.

## 해결 (이번 해커톤 산출물)

1. **경량 자체 프론트(현 `mockup.html` 확장) + Hermes OpenAI 호환 API(:8642)** 로 사내망에서 띄운다. (기존 webui fork 안 함)
2. 프로필별 API endpoint 를 **병렬 호출하는 멀티 에이전트 워크스페이스(슬랙 워크스페이스풍)** UI 를 구현한다 — 여러 세션이 동시에 살아있어(백그라운드 스트리밍·안읽음 배지) 한 패널에서 전환하며 본다(분할 동시 뷰 아님). ← 이번 해커톤의 핵심 기여
3. 본인 직무에 맞춘 **직무 특화 에이전트 프로필 세트**를 구성한다 (각 프로필 = 독립 메모리/세션/SOUL.md).
4. 리더 프로필이 하위 에이전트에 작업을 분배(**hermes 네이티브 `delegate_task`** — 새로 구현 아님)하고, **세션을 모아 주간보고를 자동 생성**한다.
5. **작업/스킬 Kanban** — 에이전트별 작업과 보유 스킬을 보드로 한눈에 본다. 특히 **스킬 보드**(어느 에이전트가 무슨 능력을 가졌나 + on/off)가 유용.

## 베이스 / 구현 방식

- **경량 자체 프론트엔드 + Hermes OpenAI 호환 API.** 기존 webui 를 fork 하지 않는다 (강결합·전환식 회피).
- 프론트: 지금의 `mockup.html` 을 확장 — 멀티채팅 / 스킬 보드 / 주간보고. (정적 + 바닐라 JS, 빌드 없음)
- **경량 백엔드 래퍼(필수)**: API 키를 브라우저에 노출하지 않기 위한 프록시 + `hermes` CLI 조회(상태·스킬). 엔드포인트 계약은 `SPEC.md` 참조. (프론트를 백엔드가 동일 출처로 서빙하면 CORS 불필요)
- 전제: 리눅스 서버에 Hermes Agent 본체가 설치/동작 중. 각 직무 프로필마다 **API 서버를 활성화하고 다른 포트로 동시 기동**한다:
  - 각 프로필 `~/.hermes/profiles/<name>/.env`: `API_SERVER_ENABLED=true` · `API_SERVER_KEY=<key>` · `API_SERVER_HOST=0.0.0.0` · `API_SERVER_PORT=<고유포트>`
  - 기동(gateway 명령이 API 서버 포함): `hermes -p driver gateway &` · `hermes -p reviewer gateway &` …
- **구현 계약은 `SPEC.md`, 채울 환경값은 `.env.example` / `agents.config.example.json` 참조.**
- 참고 fork(코드 참조용, 베이스 아님): `nesquena/hermes-webui`, `JPeetz/Hermes-Studio` (둘 다 MIT).

## 아키텍처 / 통신 구조 (반드시 숙지)

- **채팅 통신 = Hermes OpenAI 호환 API.** `hermes config set API_SERVER_ENABLED true` → 기본 **:8642**, `/v1/chat/completions`·`/v1/models`. 모듈 import(강결합) 안 쓴다. 표준 HTTP 라 프론트와 hermes 가 **다른 머신이어도 된다.**
  - API 로 호출해도 hermes 의 **memory / skills / tool 실행은 그대로 유지** (단순 chat completion 아님).
- **멀티 에이전트 = 프로필별 포트 (수동 매핑, 자동발견 아님).** 포트 동적 레지스트리는 **없다** — 각 프로필 `.env` 에 `API_SERVER_PORT` 를 수동 지정하고, 프론트는 `agents.config.json` 의 프로필↔포트 매핑으로 endpoint 를 안다 (`/v1/models` 는 그 포트의 단일 프로필만 광고). 프론트는 매핑된 endpoint 들을 **병렬 호출** → 동시 독립 멀티채팅.
- **세션/메모리.** Chat Completions 는 **stateless** — 멀티턴은 프론트가 `messages` 배열을 **누적 전송**한다. 장기 메모리 연속은 헤더 `X-Hermes-Session-Key: <프로필명>` 고정으로 얻는다 (프로필별 독립).
- **메타데이터 = hermes CLI 보강.** OpenAI API 에 없는 정보는 백엔드 래퍼가 CLI 로 조회: 스킬 `hermes -p <p> skills list`, 상태 `hermes -p <p> gateway status`(또는 `:port/health`), 작업 `kanban.db`(스키마 미상 → 스트레치), **주간보고 입력** `hermes -p <p> sessions export`(JSONL · 세션 ID `YYYYMMDD` prefix 로 주 단위 슬라이싱). 스킬 on/off 는 `hermes -p <p> skills config` / `tools enable|disable` — **변경은 다음 세션(/reset)부터 적용**(즉시 아님)이므로 UI 에 표기.
- **오케스트레이션 = hermes 네이티브(단, API 경유 트리거는 당일 검증).** 리더 프로필에 요청하면 내부 `delegate_task`(role=orchestrator/leaf)로 하위 호출·취합하는 게 설계 의도. **다만 API(orchestrator 프로필 호출) 경유 위임이 실제 작동하는지는 공식 문서에 미명시 → 당일 검증 필요.** 중간 과정은 스트리밍 커스텀 이벤트 `hermes.tool.progress` 로 delegation 카드를 그릴 수 있다. 안 되면 결과만, 또는 발표 언급만 (스트레치).
- **접속**: 브라우저 → 사내 LAN → 프론트(+백엔드 래퍼) → 각 프로필 API(:8642+). non-loopback 바인딩은 `API_SERVER_KEY` 인증 필수.
- 함의: 채팅이 표준 API 라 **자체 프론트 신규 구현이 fork 보다 빠르고 깔끔**. `mockup.html` 을 키우면 된다.

## 직무 특화 에이전트 프로필 (사용자 회사 업무 기준)

| 프로필 | 역할 | 비고 |
|---|---|---|
| `driver` | 리눅스 디바이스 드라이버 설계·구현·디버깅 | 시니어 드라이버 엔지니어 페르소나 |
| `architect` | 코드 설계 (드라이버 + 에이전트 SW) | 구조·트레이드오프 중심 |
| `reviewer` | 패치 리뷰 | 리뷰 체크리스트 기반, 비판적 톤 |
| `report` | 주간보고·발표자료 작성 | 집계·요약·문서화 특화 |
| `brainstorm` | 아이디어 브레인스토밍 | 발산형, 제약 적게 |
| `lead` (스트레치) | 오케스트레이션 리더 | 위 에이전트에 분배 + 주간보고 집계 |

- 각 프로필은 `hermes profile create <name> --clone` 으로 생성하고 `SOUL.md` 로 페르소나를 다르게 준다.
- 프로필별 게이트웨이는 launchd/systemd 로 **동시 가동** 가능 (이미 default+maccoder 로 검증된 패턴).

## 작업 원칙

- **데모 우선**: 평가는 "되는 것을 보여주는 것". 안 되는 기능 완성도보다 시연되는 흐름을 먼저 확보한다.
- **폴백 항상 유지**: 멀티채팅 UI 개조가 막히면 → 전환식 그대로 두고 "직무 프로필 + 주간보고 자동화"만으로도 데모가 성립하도록 한다. (TODO.md 의 폴백 표시 참조)
- **상류 fork 를 함부로 갈아엎지 않는다**: 개조는 최소 침습. 기존 동작을 깨면 데모 전체가 위험하다.
- 200줄로 될 일을 50줄로. 해커톤이라도 군더더기 금지.
- 막히면 멈추고 폴백으로 전환. 한 기능에 매몰되지 않는다.

## 절대 하지 말 것

- 회사 고유 정보(구체적 수치·사내 코드·고유명사·실제 패치 내용)를 레포/발표자료에 넣지 않는다. 직무는 **일반적 개념 수준**으로만 표현한다.
- API 키 / bot token / `.env` / `auth.json` 등 시크릿을 git 에 커밋하지 않는다. (`.gitignore` 먼저 확인)
- Hermes 본체의 `~/.hermes/auth.json` 을 복사하지 않는다. 공유가 필요하면 symlink (refresh-token 회전 충돌 방지).
- 사용자 확인 없이 사내 서버 설정(방화벽/포트/인증)을 바꾸지 않는다.

## 데모 성공 기준 (이게 보이면 성공)

1. 윈도우 PC 브라우저로 사내 서버 webui 접속 (SSH·`hermes` 커맨드 없이).
2. 사이드바에 `driver` / `reviewer` / `report` 등 에이전트 목록 + 상태(초록불).
3. 두 개 이상의 에이전트와 **각각 독립 세션**으로 대화 — 한쪽과 대화하는 동안 다른 에이전트 응답이 백그라운드로 도착(안읽음 배지), 전환해 확인 (슬랙처럼).
4. (킬러) `report` 또는 `lead` 에게 "이번 주 한 일 주간보고" → 세션/메모리 집계해서 보고서 출력.
5. (스트레치) `lead` 가 "패치 리뷰 + 드라이버 점검"을 하위 에이전트에 동시 분배.
