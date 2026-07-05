# 세션 핸드오프 로그 (2026-07-05)

> 세션 재시작 대비 진행상황 스냅샷. **다음 세션 AI는 이 문서 + `docs/AI-GUIDE.md`(운영·rules) + `docs/EXPLORE-NEXT.md`(백로그)를 먼저 읽어라.**
> 값·경로 사실이 지금과 다르면 실측 후 갱신(AI-GUIDE §7 rules).

## 1. 지금 실행 중인 것 (스냅샷)
| 서비스 | 포트 | 상태 | 재부팅 자동기동? |
|---|---|---|---|
| 게이트웨이 maccoder/news/trading | 8642/8643/8644 | ✅ 실행(launchd) | ✅ (`ai.hermes.gateway-*`) |
| default(맥비) 게이트웨이 | — | ✅ (Hermes 기본, launchd 84306) | ✅ |
| webui (hermes-webui) | 8787 | ✅ | ✅ (`com.hermestalk.webui`) |
| **Paperclip** | 3100 | ✅ (`npx paperclipai onboard` 포그라운드) | ❌ **수동 재기동 필요** |
| HermesTalk (우리 앱, dev) | 3000 | ❌ 미실행 | ❌ 수동 |

- Hermes Agent: **v0.18.0 (2026.7.1)**, main. 프로필 9개: default(맥비)·maccoder·news·trading·architect·designer·coder·reviewer·reporter.
- cron: news `daily-news-brief`(매일 19:00) · maccoder `weekly-wiki-lint`(일 20:00).
- **dispatcher는 default(맥비) 하나만** ON (나머지 게이트웨이 `dispatch_in_gateway:false`).

## 2. 재부팅/재시작 복구 방법
- **게이트웨이·webui**: launchd라 자동 복구. 안 뜨면 `hermes --profile <p> gateway restart`.
- **Paperclip(수동)**: `cd /Users/wooki/project/toy/paperclip && npx -y paperclipai@latest onboard --yes` → :3100. 데이터는 `~/.paperclip/instances/default/`.
- **HermesTalk(수동, 선택)**: `cd <repo>/app && HERMES_API_URL=http://127.0.0.1:8642 HERMES_API_TOKEN=<프로필 .env의 API_SERVER_KEY와 동일값> HERMESTALK_GATEWAYS=... HERMESTALK_KANBAN_PROFILE=maccoder pnpm dev` → :3000.
- **채팅 무응답/모델 죽음**: `codex` → `hermes --profile maccoder auth` (Codex 토큰 재인증). 이전에 겪음.

## 3. 이번 세션 완료 항목
1. **문서 체계 확립**: `README`(설치/사용), `CLAUDE.md`(방향+AI-GUIDE 참조 rule), `docs/AI-GUIDE.md`(AI 운영 가이드+§7 문서유지 rules), `docs/RESEARCH-multi-agent.md`(모델등급별 전략), `docs/EXPLORE-NEXT.md`(백로그), `docs/HERMES-WEBUI.md`. 원격 push 완료(hermestalk-init).
2. **#1 공유 llm-wiki**: `/Users/wooki/project/toy/hermes-wiki`(`WIKI_PATH` 글로벌, 전 프로필 공유), git 추적 + 주간 lint cron. 쓰기/공유 검증(news 작성→maccoder 읽음).
3. **#3 뉴스 cron**: 매일 19:00 4분야 브리핑(local). news 에이전트 웹검색 실동작 확인.
4. **#4 칸반 역할 파이프라인 5역할**: architect→designer→coder→reviewer→reporter 프로필+SOUL. roman 데모 전단계 완주(ARCHITECTURE→DESIGN→구현+테스트→REVIEW→REPORT).
5. **정체성 정리**: default=맥비(SOUL 명시), 나머지 프로필 memory의 "맥비" 잔재 제거→각자 이름.
6. **dispatcher 단일화**: churn(여러 게이트웨이 동시 dispatch) 원인 제거 → default만 ON.
7. **Hermes Agent 업데이트**: v0.13.0→v0.18.0(main). 로그 `/Users/wooki/project/toy/hermes/hermes-agent-update-2026-07-04.md`.

## 4. 지금 하던 것 (이어서 할 지점) — #6 Paperclip PoC
- ✅ Paperclip 설치·기동(:3100), **`hermes_local`·`hermes_gateway` 내장 어댑터 확인**(소스 수정/별도 npm 어댑터 불필요 — 중요).
- ⏳ **다음 단계(미완)**: Paperclip UI(http://127.0.0.1:3100)에서 → ① 회사(Company) 생성(현재 company=[]) → ② 직원 추가(어댑터 `hermes_local`, 모델 지정, 이름) → ③ 이슈 생성 후 그 직원에 배정 → ④ heartbeat로 Hermes가 처리하는지 관찰.
- 판단 포인트: Paperclip(조직·거버넌스) vs 네이티브 칸반(#4, 이미 동작) 중 회사 시나리오에 뭘 쓸지.

## 5. 다음 후보
- #6 Paperclip PoC 마무리(UI로 회사/직원/이슈).
- 회사 약한-오픈모델 PoC(방식 B + 검증 게이트) — 오픈모델 게이트웨이 필요(보류 중).
- 5역할 실사용 / news→위키 자동적재 / TODO Phase 7(진짜 멀티 agent 단톡방).

## 6. 주의/교훈
- **dispatcher 보드당 1개**(여럿이면 churn). 워커 모델 행 시 그 워커 kill 후 재dispatch.
- 프로필 정체성은 **SOUL**에. 클론(`--clone-from`)은 원본 memory 이름까지 복사됨.
- 약한 모델(회사): 자율 스웜 금지, 좁은 역할+검증 게이트+짧은 체인(RESEARCH 문서).
- 시크릿(API 키/봇 토큰)은 프로필 `.env`·plist에만. 문서엔 값 금지.
- `~/.hermes/*`(프로필)·`~/.paperclip`·`~/project/toy/hermes-wiki`는 이 git 저장소 밖(로컬).
