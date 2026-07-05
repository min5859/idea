# AI 운영 가이드 — Hermes 멀티에이전트 (개인 + 회사 적용)

> **이 문서의 대상 = AI 어시스턴트(Claude Code / Codex / Hermes 등).**
> Hermes 기반 멀티에이전트 도구를 **집(SOTA 모델)과 회사(약한 오픈모델, 보안·비용 제약)** 양쪽에
> 재현·운영하는 법을 담는다. 새 세션의 AI는 작업 전에 이 문서를 먼저 읽는다.
> 배경/의사결정 근거는 `CLAUDE.md`, 리서치는 `docs/RESEARCH-multi-agent.md`, 탐색 백로그는 `docs/EXPLORE-NEXT.md`.

---

## 0. 최상위 원칙 (반드시 지킬 것)
1. **real-first, mock 금지.** 기능은 실제 게이트웨이/DB로 검증(스크린샷·로그·실호출). 검증 없이 "됐다" 금지.
2. **파괴적/비가역 작업은 먼저 확인.** `~/.hermes` 설정·프로필 삭제·`git reset`·게이트웨이 재시작(텔레그램 끊김)·대량 업데이트 전 백업·롤백 경로 마련 + 사용자 확인.
3. **모델 등급에 맞는 방식 선택** (§3 핵심). SOTA와 약한 모델은 정반대 전략.
4. **최소 침습.** 기존 것 크게 안 갈아엎고 레이어로 얹는다.
5. **문서 동기화(§7 rules).** 에이전트/크론/파이프라인/모델/결정이 바뀌면 관련 문서를 같은 변경에서 갱신한다.

---

## 1. 현재 환경 인벤토리 (이 PC 기준 — 회사 PC는 값만 다름)
| 구성요소 | 값 |
|---|---|
| Hermes Agent | 소스: `~/.hermes/hermes-agent` (uv venv). 업데이트 §6 |
| **default = 맥비 🐝** (기본 비서) | 프로필 폴더 없음 — **`~/.hermes/` 루트 자체**가 default 프로필(SOUL·config·.env·memories). 정체성은 `~/.hermes/SOUL.md`에 명시. **공유 칸반 dispatcher 담당(유일)** |
| 게이트웨이(상시) | `maccoder`(맥코더, 코딩전문):8642 · `news`(뉴스 브리퍼):8643 · `trading`(트레이딩 분석가):8644 (프로필 `.env`의 `API_SERVER_PORT`). **dispatch는 OFF**(§2) |
| 칸반 워커 프로필(게이트웨이 없음) | `architect`·`designer`·`coder`·`reviewer`·`reporter` (5역할 파이프라인, dispatch가 필요 시 spawn) |
| 프로필 정체성 | 각 프로필의 **SOUL.md + memories/MEMORY.md 이름**이 역할과 일치(클론 시 새던 "맥비" 잔재 정리 완료). default만 맥비 |
| 인증 | 프로필 `.env` `API_SERVER_KEY` == 앱 `HERMES_API_TOKEN` (동일값, **채팅 필수**). 모델 자격증명은 `auth.json`→글로벌 `~/.hermes/auth.json` 심링크로 공유 |
| webui | `nesquena/hermes-webui`, :8787, launchd `com.hermestalk.webui` |
| HermesTalk(우리 앱) | 이 저장소(`app/`), :3000, Studio 포크 (수동 dev, 미상시) |
| Paperclip (PoC) | `npx paperclipai onboard`, :3100, 데이터 `~/.paperclip/`. **수동 재기동**(launchd 아님). `hermes_local` 내장 어댑터로 Hermes 직원 연결 |
| 공유 지식베이스 | llm-wiki `/Users/wooki/project/toy/hermes-wiki` (`WIKI_PATH` 글로벌, git 추적) |
| cron | news `daily-news-brief`(매일 19:00) · maccoder `weekly-wiki-lint`(일 20:00) |
| 자동기동(launchd) | `ai.hermes.gateway-{maccoder,news,trading}` + `com.hermestalk.webui` (default/맥비는 Hermes 기본 상시) |

> ⚠️ 프로필별 게이트웨이는 **다른 포트 + 다른 텔레그램 봇 토큰**. 같은 토큰 두 곳 = Telegram polling 충돌.
> ⚠️ 프로필 정체성은 **SOUL.md**에 둔다(memory 아님) — 클론(`--clone-from`)은 원본 memory의 이름/정체성까지 복사하니, 새 프로필 만들면 SOUL 교체 + memory의 이름 잔재 정리.

---

## 2. 3가지 오케스트레이션 방식 (구분 필수)
- **방식 A — `delegate_task`** (한 게이트웨이 안 위임): 한 에이전트가 일회용 서브에이전트로 병렬 처리·취합. Orchestrator-Worker. HermesTalk `/group`이 시각화.
- **방식 B — 네이티브 칸반** (여러 프로필 협업): 글로벌 `~/.hermes/kanban.db` 공유 보드. 태스크에 `--assignee`(=역할), `link parent child`로 의존성, `dispatch`가 ready 태스크의 assignee 프로필 워커를 격리 workspace에 spawn. Sequential Pipeline / 역할 핸드오프. **← 회사 시나리오 핵심.**
  - **dispatch = 게이트웨이 내장 스케줄러(코드, 모델 아님)**. config `kanban.dispatch_in_gateway: true` + `dispatch_interval_seconds`. 각 태스크는 **assignee 프로필**로 spawn되므로 dispatch하는 게이트웨이의 정체성은 작업과 무관.
  - 🚨 **한 보드에는 dispatcher를 정확히 1개만.** 여러 게이트웨이가 모두 `dispatch_in_gateway: true`면(기본값) + 수동 `hermes kanban dispatch`까지 겹치면 **같은 태스크를 서로 claim/reclaim 반복(churn)** → 워커가 헛돎. **해결: dispatcher 1개(항상 켜진 default/맥비)만 `true`, 나머지 게이트웨이는 `false`**, 수동 드라이버는 게이트웨이 자동이 있으면 쓰지 않음.
  - 워커가 완료 후 `blocked{kind:needs_input, review-required}`로 self-block 가능(핸드오프 게이트) → 승인은 `kanban unblock <id> && kanban complete <id>`, 자동 흐름 원하면 태스크 body에 "block 말고 done" 명시. 워커가 모델 응답에서 멈추면 해당 워커 프로세스 kill 후 재dispatch.
- **Paperclip** (외부 플랫폼): 에이전트를 "회사 직원(조직도·목표·거버넌스·예산)"으로. adapter로 Hermes 연결. Node+Postgres 별도 설치(§docs/EXPLORE-NEXT #6).

---

## 3. 모델 등급별 전략 ★ (회사 적용의 핵심)
근거: 신뢰도는 복리로 곱해진다(스텝당 90% → 5스텝 ≈59%). 상세 `docs/RESEARCH-multi-agent.md`.

| | 집 (SOTA: Opus/GPT5.5) | **회사 (약한 오픈모델: Gemma/Qwen/MiMo/Kimi)** |
|---|---|---|
| 기본 | 강한 단일 에이전트 + 위임(방식 A) | **좁게 분해한 역할 파이프라인(방식 B)** |
| 자율성 | 많이 | **최소화** — 순서를 코드/칸반으로 고정 |
| 체인 | 길어도 OK | **짧게**, 스텝마다 좁게 |
| 검증 | 가끔 | **스텝마다 검증 게이트 필수**(테스트·리뷰어·self-consistency) |
| 모델 | 성능 최우선 | **tool-calling 안정성 우선**(Kimi/Qwen/GLM), "믿을 수 있는 가장 작은 모델" |

**회사 규칙**: 약한 모델 하나에 긴 자율 코딩 통째 위임 금지. "자율 스웜" 아니라 "**결정적 워크플로우 + 좁은 역할 + 검증**". → 방식 B 또는 Paperclip.

---

## 4. 플레이북 (그대로 따라 하면 됨)

### 4.1 새 에이전트(프로필) 추가
```bash
hermes profile create --clone-from <기준프로필> --no-alias <이름>   # 작동하는 모델설정 상속
ln -sfn ~/.hermes/auth.json ~/.hermes/profiles/<이름>/auth.json      # 모델 자격증명 공유
# SOUL.md를 역할에 맞게 차별화(반드시! 클론은 기준프로필 인격 그대로)
```
- **채팅용 게이트웨이로 쓸 경우**만: `.env`에 `API_SERVER_ENABLED=true` + `API_SERVER_KEY=<공통키>` + `API_SERVER_PORT=<빈 포트>`, 텔레그램 쓰면 **전용 봇 토큰**(복제된 토큰은 반드시 교체/주석). 이후 `hermes --profile <이름> gateway restart` (+ 부팅자동 `gateway install`).
- **칸반 워커로만 쓸 경우**: 게이트웨이 불필요(dispatch가 spawn). 프로필 + auth + SOUL만.

### 4.2 공유 지식베이스(llm-wiki)
- Hermes 번들 스킬 `llm-wiki`(research/). `WIKI_PATH`(글로벌 `~/.hermes/.env`)로 **모든 프로필 공유**.
- 구조: `SCHEMA.md`/`index.md`/`log.md` + `raw/ entities/ concepts/ comparisons/ queries/`.
- **품질 저하 방지**: ① git 추적(되돌리기·감사) ② 주간 lint cron(모순·중복 점검 + 스냅샷 커밋) ③ 가능하면 쓰기 소유권 분담(섹션별/큐레이터), 읽기는 전원.
- 사용: 아무 에이전트에게 "공유 위키에 ~ 정리/검색".

### 4.3 데일리 자동 작업(cron)
```bash
hermes --profile <p> cron create '<schedule>' '<prompt>' --name <이름> --deliver <local|telegram|origin> [--workdir <경로>]
hermes --profile <p> cron run <id>     # 즉시 1회 테스트
```
- 결과 확인: webui(:8787) 해당 프로필 → Tasks 패널 / Sessions. 출력물 `~/.hermes/profiles/<p>/cron/output/`.
- 텔레그램 푸시는 `--deliver telegram` + 프로필에 봇 토큰.

### 4.4 역할 파이프라인(방식 B, 회사 핵심) — 검증된 레시피 (5역할 실증)
architect → designer → coder → reviewer → reporter (프로필 5개, 각 SOUL 차별화). 실증 완료(gcd·roman 데모).
산출물 파일로 핸드오프: `ARCHITECTURE.md`(architect) → `DESIGN.md`(designer) → `roman.py`+테스트+`IMPLEMENTATION.md`(coder) → `REVIEW.md`(reviewer) → `REPORT.md`(reporter).
```bash
WS=<공유 workspace 절대경로>; mkdir -p "$WS"
A=$(hermes kanban create "<상위설계>" --body "접근법·스코프·리스크만 ARCHITECTURE.md에. 코드/상세 시그니처 금지." --assignee architect --workspace "dir:$WS" --json | jq -r .id)
D=$(hermes kanban create "<상세설계>" --body "ARCHITECTURE.md 읽고 DESIGN.md에 시그니처·데이터·엣지케이스·테스트계획. 코드 금지." --assignee designer --parent "$A" --workspace "dir:$WS" --json | jq -r .id)
C=$(hermes kanban create "<구현>" --body "DESIGN.md대로 구현+테스트 실행 통과. IMPLEMENTATION.md. 완료되면 block말고 done." --assignee coder --parent "$D" --workspace "dir:$WS" --json | jq -r .id)
R=$(hermes kanban create "<리뷰>" --body "설계·구현 검수, 테스트 실행, REVIEW.md에 PASS/CHANGES_REQUESTED." --assignee reviewer --parent "$C" --workspace "dir:$WS" --json | jq -r .id)
P=$(hermes kanban create "<최종리포트>" --body "전 산출물 종합 REPORT.md(무엇을·결정·검증·남은일)." --assignee reporter --parent "$R" --workspace "dir:$WS" --json | jq -r .id)
hermes kanban dispatch --dry-run       # 미리보기(안전)
# 실행: dispatcher는 default(맥비) 게이트웨이가 60초마다 자동. 수동으로 겹쳐 돌리지 말 것(§2 churn).
```
- **핸드오프**: parent done → child 자동 ready. 워커는 공유 workspace에서 앞 단계 산출물을 읽음.
- **🚨 dispatcher 1개만**(§2): 수동 `hermes kanban dispatch`를 게이트웨이 자동과 동시에 돌리면 churn. default만 dispatch ON이면 수동 불필요.
- self-block(needs_input/review-required) → `kanban unblock <id> && kanban complete <id>`. 워커가 모델 응답에서 멈추면 그 워커 kill 후 재dispatch.
- **약한 모델**이면: 역할을 더 좁게, 각 태스크 body에 입출력·검증기준 명확히, reviewer 단계를 검증 게이트로 강하게, 태스크 `--max-runtime` 넉넉히(느린 모델 reclaim churn 방지).

### 4.5 안전한 Hermes 업데이트 → §6

---

## 5. 확인/트러블슈팅
- 상태: `hermes gateway status`, 포트 `/health`(8642~8644,8787,3000), `hermes --profile <p> cron list`, `hermes kanban list`.
- 채팅 무응답 + `403 Session continuation` → `API_SERVER_KEY`↔`HERMES_API_TOKEN` 불일치. 빈 응답/`run.failed` → 모델 토큰 만료(`codex`/`hermes auth`/`hermes model`).
- 좌상단 OFFLINE(HermesTalk dev) → 토큰 없이 띄움. 토큰과 함께 재기동+새로고침.
- 포트 좀비 → `lsof -nP -tiTCP:<port> -sTCP:LISTEN | xargs kill -9`.

---

## 6. Hermes Agent 업데이트 (통제된 방식)
- `hermes update`는 **`main`**(대량 커밋)으로 감. 안정 릴리스 고정을 원하면 **태그 checkout**:
  `cd ~/.hermes/hermes-agent && git fetch --tags && git checkout v<태그> && ~/.local/bin/uv pip install --python venv/bin/python -e . && (게이트웨이 재시작)`
- 항상: 먼저 `hermes update --check`, 백업은 기본 OFF이니 `hermes update --backup --yes`(또는 롤백 태그). 실사례 로그: `/Users/wooki/project/toy/hermes/hermes-agent-update-*.md`.
- 업데이트 후 게이트웨이 재시작 + 버전/헬스/모델응답 검증.

---

## 7. 문서 유지 규칙 (RULES — AI가 지킬 것)
작업하며 아래가 바뀌면 **같은 작업 단위에서 관련 문서를 갱신**한다(문서 부채 금지):

| 무엇을 바꿨나 | 갱신할 문서 |
|---|---|
| 프로필/게이트웨이/포트/크론 추가·삭제 | 이 문서 §1 인벤토리 |
| 새 오케스트레이션 방식·패턴 결정 | `CLAUDE.md`, 필요 시 §2·§3 |
| 리서치/근거 갱신 | `docs/RESEARCH-multi-agent.md` |
| 탐색 항목 진행/완료 | `docs/EXPLORE-NEXT.md` |
| Hermes/webui 업데이트 | `/Users/wooki/project/toy/hermes/…-update-*.md` (날짜별 append) |
| 설치/실행/사용법 변경 | `README.md`, webui는 `docs/HERMES-WEBUI.md` |
| Phase 진척 | `TODO.md` |

추가 규칙:
- 새 플레이북을 실행해 검증했으면 §4에 레시피로 추가(실측 명령 그대로).
- 실측으로 문서의 사실이 틀린 걸 발견하면 **즉시 정정**하고 근거(로그/출력)를 남긴다.
- 시크릿(API 키·봇 토큰)은 문서에 **값을 넣지 말고** 위치만 참조.
- 커밋은 사용자 요청 시. 문서 변경도 논리 단위로 커밋 메시지에 반영.
