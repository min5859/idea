# 앞으로 해볼 것 (Hermes multi-agent 탐색 백로그)

> 실사용하며 시도해볼 아이디어 메모. (2026-06 기준 상태 주석 포함)
> 환경 요약: 게이트웨이 maccoder(:8642)·news(:8643)·trading(:8644) + webui(:8787) + HermesTalk(:3000),
> 게이트웨이 `API_SERVER_KEY` + 앱 `HERMES_API_TOKEN` 동일값. 셋 다 launchd 자동기동 등록됨.

## 1. LLM Wiki 셋업 — agent끼리 지식 공유
- 목표: 여러 Hermes agent가 공유하는 지식 베이스(위키).
- 단서: webui의 **dynamic recall prefill** 라우터(Joplin/Obsidian/Notion/**llm-wiki**) — `hermes-webui/docs/advanced-chat-setup.md`. Hermes 자체 **memory/skills**(`~/.hermes/.../MEMORY.md`, 스킬 시스템)도 공유 지식 수단.
- 상태: **미시작**. 어떤 백엔드(llm-wiki 서버? Obsidian?)로 할지 결정 필요.

## 2. 현재 agent 도는지 확인
- ✅ **확인됨(2026-06)**: maccoder·news·trading 모두 running. `hermes gateway status` 또는 4개 포트 `/health`로 상시 확인.
- launchd 자동기동: `ai.hermes.gateway-{maccoder,news,trading}` + `com.hermestalk.webui` 등록 → 재부팅 자동 복구.

## 3. news agent 데일리 cron — ✅ 완료
- **잡 생성됨**: `daily-news-brief` (id `1d128439bd39`), **매일 19:00**(`0 19 * * *`), `--deliver local`.
- 프롬프트: 4개 분야(기술/AI·금융/증시·개발자/스타트업·한국 일반뉴스) 각 5개 + 출처·링크 + "오늘의 한 줄".
- 라이브 실측: 실제 최신 기사(연합뉴스·전자신문·플래텀·DevClass 등) 4×5개 스크랩 확인.
- **확인 위치**: webui(:8787) news 프로필 전환 → Sessions(api_server 세션) / Tasks 패널. 출력은 `~/.hermes/profiles/news/cron/output/`.
- 남은 것: 텔레그램 푸시 원하면 봇 토큰 발급 후 `--deliver telegram`으로 edit.

## 4. kanban 파이프라인: architect → designer → coder → reviewer → reporter
- 방식 B(네이티브 칸반 협업)에 정확히 맞는 시나리오.
- **각 역할 = 프로필(assignee).** `hermes kanban create --assignee architect ...` 식으로 태스크를 역할에 배정하면 디스패처가 해당 프로필 게이트웨이를 기동해 claim·처리, 부모-자식 의존성/핸드오프 지원.
  - 참고: 예전에 삭제한 `pm/frontend-eng/reviewer/tauri-backend`가 **바로 이 패턴**(칸반이 역할별 워커 프로필로 만든 것)이었음.
- 새 프로필 필요? → 역할별로 만드는 게 정석(각자 SOUL.md로 페르소나 차별화). 단순하게는 1개 프로필이 여러 역할 겸임도 가능(권장 X — 차별화가 협업 품질).
- webui **Tasks/Kanban 패널**에서 진행 가능(webui는 칸반 read+write). HermesTalk는 현재 read 전용.
- 남은 작업: architect/designer/coder/reviewer/reporter 프로필 생성 + 각 SOUL.md + 의존성 체인 태스크 생성 + 디스패처 동작 확인.

## 5. 기타 multi-agent 생산성 시도
- 그룹방 위임(방식 A, HermesTalk `/group`)으로 리더가 서브에이전트에 병렬 위임.
- 진짜 멀티 agent 단톡방(@A→A, @B→B) = TODO Phase 7.
- 프로필별 스킬 특화, 메모리 공유, cron 기반 자동 리포트 등.

---

## 6. [분석] hermes-paperclip-adapter + Paperclip — 내 시나리오 적합성
> https://github.com/NousResearch/hermes-paperclip-adapter (어댑터, MIT, TypeScript)
> https://github.com/paperclipai/paperclip (본체, **MIT·오픈소스·자체호스팅·무료**)

### 무엇인가
- **Paperclip** = "AI 에이전트를 회사 직원처럼 운영"하는 오케스트레이션 플랫폼. Node/TS + React + PostgreSQL(로컬 임베디드) + Docker, `npx paperclipai onboard` 로 로컬 :3100 기동.
  - **조직도(org chart)**: 에이전트에 역할·직함·리포팅 라인·job description 부여.
  - **직원 = BYO 에이전트**: Claude Code, Codex, OpenClaw, bash, HTTP 봇 — 그리고 **어댑터로 Hermes**.
  - **목표·태스크**: 모든 작업이 회사 미션까지 추적("why"를 앎). ticket 시스템 + 대화 추적.
  - **거버넌스/회계**: board 승인, 에이전트 pause/terminate, per-agent 예산 하드스톱, 감사 로그, 비용 추적.
  - **실행**: heartbeat 스케줄, atomic task checkout(중복작업 방지), 멀티 컴퍼니 데이터 격리.
- **hermes-paperclip-adapter** = Hermes CLI를 spawn해 Paperclip 태스크를 처리하고 결과를 구조화 transcript로 리포트하는 **다리**. 세션 영속·스킬 동기화·비용 추적·comment 기반 wake.

### 내 시나리오 적합성
| 내 니즈 | Paperclip 적합성 |
|---|---|
| **#4 역할 파이프라인**(architect→designer→coder→reviewer→reporter) | ✅ **매우 적합**. 내가 손으로 짜려던 "역할별 프로필 + 의존성 체인"의 **상위 제품화 버전**. 조직도·리포팅·목표·티켓이 기본 제공 |
| **#5 멀티에이전트 생산성** | ✅ 정확히 이걸 위한 플랫폼. 예산/거버넌스/감사까지 |
| **자체호스팅·개인도구** | ✅ MIT·무료·로컬 Postgres·Docker (SaaS 아님) |
| **Codex 사용** | ✅ 직원으로 Codex/Claude Code/Hermes 다 가능 |
| **유지보수 최소화** | ⚠️ **주의**: Node+Postgres 스택 하나 더 상시 운영. 이미 게이트웨이 3 + webui + HermesTalk 도는 위에 추가 |

### 결론 / 추천
- **#4·#5의 정답에 가까움.** architect→…→reporter를 네이티브 칸반으로 손수 짜는 것보다, **Paperclip이 조직도·역할·목표·거버넌스·비용통제를 기본 제공**하므로 훨씬 완성형. Hermes agent들(maccoder/news/trading 또는 역할 전용)을 어댑터로 "직원"으로 붙이면 됨.
- **트레이드오프**: (1) Node/Postgres 서비스 추가 운영 부담, (2) HermesTalk의 group-room/네이티브 칸반 야망과 상당 부분 **중복/대체** — 즉 Paperclip 채택 시 HermesTalk의 멀티에이전트 파트는 사실상 불필요해질 수 있음. (3) 학습곡선(조직도·티켓·거버넌스 개념).
- **다음 액션 후보**:
  1. `npx paperclipai onboard --yes`로 로컬 :3100 기동 → 어댑터로 maccoder 1명 붙여 "직원" 동작 확인(가벼운 PoC).
  2. 되면 architect/designer/coder/reviewer/reporter를 직원으로 등록해 **#4를 Paperclip에서** 구현(네이티브 칸반 대신).
- **판단 포인트**: "Hermes 네이티브 칸반(방식 B)으로 충분한가 vs Paperclip의 조직/거버넌스가 필요한가". 여러 역할·예산·감사가 중요하면 Paperclip, 단순 태스크 큐면 네이티브 칸반.

---
> 진행할 때: 하나씩 골라서 요청하면 그 항목만 통제된 방식으로 세팅.
> 지금 상태: #2·#3 완료. 다음 후보 = #1(llm-wiki, 가벼움) / #6 Paperclip PoC(#4·#5 대체 검토) / #4 네이티브 칸반 파이프라인.
