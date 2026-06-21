# HermesTalk

> 멀티 에이전트 메신저. 여러 도메인 특화 **Hermes** 에이전트를 채팅방으로 관리하고,
> 그룹방에서 리더가 서브에이전트에게 위임·취합한다.
> **Hermes Studio(`JPeetz/Hermes-Studio`, MIT) 포크 + 메신저 UX 레이어.** 셀프호스팅 개인 도구.

집/회사 PC 각각에서, **그 PC에 떠 있는 Hermes 게이트웨이만** 자동으로 채팅방에 표시한다.

---

## 0. 구성 한눈에

```
┌─ 브라우저 (http://localhost:3000) ─────────────┐
│  HermesTalk = Hermes Studio 포크 (app/)         │   ← 이 저장소
│  TanStack Start + React, 서버측에서 게이트웨이 프록시 │
└───────────────┬─────────────────────────────────┘
                │ HTTP (/api/* → 127.0.0.1:8642)
┌───────────────▼─────────────────────────────────┐
│  Hermes 게이트웨이 (api_server :8642)            │   ← 별도 설치(Hermes 본체)
│  프로필 1개 = 게이트웨이 1프로세스 = 포트 1개      │
│  ~/.hermes/profiles/<프로필>/ (kanban.db·state.db)│
└──────────────────────────────────────────────────┘
```

- **에이전트 N개 = 게이트웨이 프로세스 N개**(PC당). 어느 봇과 얘기할지는 **포트(baseUrl)** 로 결정.
- 앱은 모델을 직접 호출하지 않고 **게이트웨이를 프록시**한다. 모델 인증·텔레그램·칸반은 전부 게이트웨이(Hermes) 쪽 기능.

---

## 1. 사전 준비물

| 항목 | 버전/비고 |
|---|---|
| Node.js | 20+ (개발 환경 기준 v24) |
| pnpm | `corepack prepare pnpm@latest --activate` (또는 11+) |
| Hermes Agent | 본체 설치 + `hermes` CLI가 PATH에 (예: `~/.local/bin/hermes`) |
| 모델 자격증명 | 프로필이 쓰는 모델(예: Codex/Anthropic 등) 인증 완료 |
| git | 저장소 클론용 |

> Hermes 본체 설치는 공식 문서를 따른다: https://hermes-agent.nousresearch.com/docs/

---

## 2. 게이트웨이(Hermes) 설정 — PC마다 1회

### 2-1. 프로필 확인 / 생성
```bash
hermes profile list                 # 현재 프로필 확인
# 없으면 새로: hermes profile create <프로필명>
```
이 PC에서 쓸 프로필명을 정한다(예: 집=`maccoder`, 회사=`workpc`). **PC마다 달라도 된다.**

### 2-2. api_server 켜기 (앱 연동의 핵심)
**프로필 전용** `.env`에 추가한다. ⚠️ 글로벌 `~/.hermes/.env`가 아니라 프로필별 파일:
```bash
# ~/.hermes/profiles/<프로필>/.env
API_SERVER_ENABLED=true
# 네트워크에 노출하거나 다른 기기에서 붙을 때만(로컬 루프백은 무인증):
# API_SERVER_KEY=<원하는-키>
```
재시작:
```bash
hermes --profile <프로필> gateway restart
```
> ⚠️ foreground `run --replace`는 launchd/서비스 락과 충돌하니 쓰지 말 것. `gateway restart` 사용.

확인:
```bash
curl -s http://127.0.0.1:8642/v1/models      # {"data":[{"id":"<프로필>",...}]}
curl -s http://127.0.0.1:8642/health
```

### 2-3. (선택) 텔레그램 — 웹·텔레그램 동시 사용
같은 프로필 `.env`에 봇 토큰을 넣으면 Hermes가 알아서 처리(우리 코드 아님):
```bash
TELEGRAM_BOT_TOKEN=<봇토큰>
TELEGRAM_ALLOWED_USERS=<텔레그램_user_id>
```
- **프로필마다 봇 토큰 1개.** 같은 토큰을 두 게이트웨이에서 쓰면 Telegram이 동시 polling을 거부.
- `~/.hermes/` 세션·메모리 공유 → 텔레그램 대화를 웹에서 이어볼 수 있다.

### 2-4. (선택) 부팅 시 자동 기동
```bash
hermes --profile <프로필> gateway install   # systemd/launchd 등록
```

### 2-5. 모델 인증 (응답이 안 나올 때)
게이트웨이가 `run.failed`/빈 응답을 내면 모델 토큰 만료다. 프로필이 쓰는 모델에 맞춰 재인증:
```bash
codex                                  # (Codex 사용 시) 로그인 → 새 토큰
hermes --profile <프로필> auth          # 또는: hermes model
```

---

## 3. HermesTalk 앱 설치 & 실행

```bash
git clone <이-저장소-URL> hermes-dashboard
cd hermes-dashboard/app

corepack prepare pnpm@latest --activate     # pnpm 없으면
pnpm install
pnpm rebuild better-sqlite3 esbuild unrs-resolver   # 네이티브 모듈(allowBuilds 처리됨)

# 실행 (이 PC의 프로필명으로 바꿔서)
HERMES_API_URL=http://127.0.0.1:8642 \
HERMESTALK_GATEWAYS=http://127.0.0.1:8642 \
HERMESTALK_KANBAN_PROFILE=<프로필> \
  pnpm dev      # → http://localhost:3000
```

브라우저에서 **http://localhost:3000** 접속.

> 포트 3000이 점유돼 있으면 Vite가 3001+로 자동 증가한다. 비우려면:
> `lsof -nP -tiTCP:3000 -sTCP:LISTEN | xargs kill -9`

### 환경변수 레퍼런스
| 변수 | 기본값 | 설명 |
|---|---|---|
| `HERMES_API_URL` | `http://127.0.0.1:8642` | 주 게이트웨이 baseUrl |
| `HERMES_API_TOKEN` | (없음) | api_server에 `API_SERVER_KEY` 설정 시 Bearer 토큰 |
| `HERMESTALK_GATEWAYS` | `HERMES_API_URL` 1개 | 발견할 게이트웨이 후보(콤마 구분). 예: `http://127.0.0.1:8642,http://127.0.0.1:8643` |
| `HERMESTALK_KANBAN_PROFILE` | `HERMES_PROFILE` 또는 `maccoder` | 네이티브 칸반/메시지검색이 읽을 프로필(`~/.hermes/profiles/<p>/`) |
| `HERMES_PASSWORD` | (없음) | 설정 시 웹 접속에 비밀번호 요구(원격/멀티PC 접속용) |

> **회사 PC에서 다르게 할 것**: `HERMESTALK_GATEWAYS`(그 PC에서 띄운 포트들)와 `HERMESTALK_KANBAN_PROFILE`(그 PC의 프로필명)만 PC에 맞게 바꾼다. 나머지는 동일.

### 여러 에이전트(게이트웨이)를 동시에
프로필마다 게이트웨이를 각각 띄우고(포트 다르게), 후보에 모두 넣는다:
```bash
hermes --profile devbot  gateway restart    # 예: :8642
hermes --profile opsbot  gateway restart    # 예: :8643 (프로필 .env에서 포트 지정)
HERMESTALK_GATEWAYS=http://127.0.0.1:8642,http://127.0.0.1:8643 ... pnpm dev
```
→ 사이드바 "Agents"에 **떠 있는 것만** presence와 함께 표시된다.

---

## 4. 사용법

| 기능 | 위치 | 설명 |
|---|---|---|
| **에이전트(채팅방) 목록 + presence** | 사이드바 "Agents" | 이 PC에서 떠 있는 게이트웨이만 🟢로. 클릭 → 활성 게이트웨이 전환 |
| **1:1 채팅** | Chat / New Session | 실시간 스트리밍. 텔레그램 대화도 같은 세션으로 이어짐 |
| **unread 뱃지** | 사이드바 세션 목록 | 안 읽은 세션에 accent dot + 굵게 |
| **그룹방 위임** ★ | 사이드바 "Group Room" (`/group`) | 리더에게 복합 작업 → `delegate_task` 위임이 말풍선으로(완료·소요시간) + 취합. `@`로 워커 지목. ⌘/Ctrl+Enter 전송 |
| **칸반 보드** | Tasks | 네이티브 칸반(`kanban.db`) 반영. 봇이 claim/complete하면 그대로 보임 |
| **메시지 검색** | 사이드바 Search | 세션·파일·스킬 + **메시지 본문**(state.db FTS) 검색 |

### 그룹방 위임 예시
```
delegate_task로 두 가지를 병렬로 위임해줘: (1) "hello"를 프랑스어로 번역,
(2) "hello"를 한국어로 번역. 그리고 두 결과를 한 문장으로 요약해줘.
```
→ 위임 말풍선(✓ 완료 · 3.9s) → 리더 취합("Hello"는 French로 "Bonjour", Korean으로 "안녕하세요"입니다.)

> 그룹방의 리더 = 현재 **활성 게이트웨이**(Agents에서 선택). orchestrator가 켜진 프로필이어야 위임이 동작
> (`config.yaml`의 `orchestrator_enabled: true`).

---

## 5. 상시 가동 (선택, Docker)

`app/docker-compose.yml`에 `restart: unless-stopped`가 설정돼 있다.
```bash
cd app
cp .env.example .env        # ANTHROPIC_API_KEY 등 채우기
docker compose up -d        # 게이트웨이 + Studio 상시 가동
# 세션 영속(Redis): docker compose --profile redis up -d
```
> 로컬 개발/개인 사용은 `hermes gateway install`(2-4) + `pnpm dev`가 더 가볍다. Docker는 항상 켜둘 서버용.

---

## 6. 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| 채팅 응답이 비거나 `run.failed` | 모델 토큰 만료 → **2-5 재인증**(`codex` → `hermes auth`) |
| 사이드바 Agents가 비어 있음 | 게이트웨이 미기동 → `hermes --profile <p> gateway restart`, `curl :8642/health` 확인. `HERMESTALK_GATEWAYS` 포트 확인 |
| Tasks 보드가 비어 있음 | `HERMESTALK_KANBAN_PROFILE`이 실제 프로필명인지 확인. `hermes kanban list --profile <p>`로 데이터 확인 |
| 포트 3000이 안 잡힘 | 좀비 dev 서버 → `lsof -nP -tiTCP:3000 -sTCP:LISTEN \| xargs kill -9` |
| `better-sqlite3` 로드 에러 | `pnpm rebuild better-sqlite3` |
| 원격 접속 보안 | `HERMES_PASSWORD` 설정 + (게이트웨이) `API_SERVER_KEY`. Tailscale(100.x)/LAN은 기본 허용 |

---

## 7. 두 개의 HTTP surface (혼동 주의)

| | api_server `:8642` | `hermes dashboard` `:9119` |
|---|---|---|
| 띄우기 | 프로필 `.env` `API_SERVER_ENABLED=true` + restart | `hermes dashboard` |
| 인증 | 루프백 무인증(또는 `API_SERVER_KEY`) | 세션 토큰 |
| 용도 | **앱 주 연동**(채팅·runs·jobs) | 관리 SPA + 칸반 REST |

HermesTalk는 **8642 api_server**가 주 연동이다. 칸반/메시지검색은 `~/.hermes/profiles/<p>/` DB를 readonly로 직접 읽으므로 dashboard(:9119)가 안 떠 있어도 동작한다.

---

## 8. 업스트림(Hermes Studio) 머지

이 포크의 변경은 신규 파일 위주 + 기존 파일 최소 패치다. 머지 절차·충돌 주시 지점은
[`docs/UPSTREAM-MERGE.md`](docs/UPSTREAM-MERGE.md) 참조. 원본: https://github.com/JPeetz/Hermes-Studio

## 참고 문서
- `CLAUDE.md` — 프로젝트 방향·결정 근거
- `TODO.md` — Phase별 진행 상황
- `PHASE0-VERIFICATION.md` — 게이트웨이 연동 실측 기록
- `app/HERMESTALK-FORK.md` — 포크 본체 메모
