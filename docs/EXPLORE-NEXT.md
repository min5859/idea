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

## 3. news agent 데일리 cron — 어디에 기록?
- ⚠️ **아직 cron 잡 없음** — 현재 자동 수집/기록 **안 됨**. 프로필·페르소나만 존재.
- 만들면: `hermes --profile news cron create ...` → 출력은 `~/.hermes/profiles/news/cron/output/`에 누적, 텔레그램 설정 시 푸시.
- 남은 결정: ① 실행 시각(예 08:00) ② 딜리버리(텔레그램 봇 토큰 필요 / 웹만) ③ 프롬프트(4개 분야 브리핑).
- webui **Tasks 패널**에서 GUI로 잡 생성/실행/이력 확인도 가능.

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
> 진행할 때: 하나씩 골라서 요청하면 그 항목만 통제된 방식으로 세팅. 특히 #3(뉴스 cron)과 #4(칸반 파이프라인)는 바로 착수 가능.
