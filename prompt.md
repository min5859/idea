# 시작 가이드 (실사용 개인 도구 · Hermes Studio 포크)

> 해커톤은 끝났다. 이건 집/회사 PC에서 실제로 쓰는 도구다. mock 없음, real-first.

## 첫 프롬프트 (Claude Code에 붙여넣기)

> CLAUDE.md랑 TODO.md 읽고 Phase 0(환경 검증)부터 진행해줘. 0부터 만들지 말고 Hermes Studio(JPeetz)를 포크해서 베이스로 쓰고, 메신저 UX 레이어만 얹는 방향이다.

`CLAUDE.md`는 폴더를 열면 자동으로 읽힌다. 위 프롬프트는 "포크 베이스 + real-first + Phase 순서"를 한 번 더 못박는 용도.

---

## 막히기 쉬운 함정

### 1. Hermes 게이트웨이 도달성 (가장 중요)
실사용이라 mock 도피가 없다. `HERMES_API_URL`(:8642)에 PC가 접근 가능하고 `HERMES_API_TOKEN`이 맞는지 Phase 0에서 먼저 확인. 안 되면 거기서 멈추고 보고.

### 2. N에이전트 = N게이트웨이
에이전트가 여러 개면 게이트웨이 프로세스도 각각(포트·텔레그램 봇 토큰도 각각). 그날 쓸 것만 띄우고 `<프로필> gateway install`로 자동 기동.

### 3. 포크 업스트림 드리프트
우리 변경은 Studio 원본을 갈아엎지 말고 레이어/별도 커밋으로 최소 침습. 주기적으로 업스트림 머지.

---

## 이 repo의 옛 잔재 (from-scratch Next.js 계획)
0부터 만들 때의 코드(`agents.ts`·`skills.ts`·`types.ts`)는 **이제 안 쓴다** → `legacy/`로 이동 보관함(실제 코드 정본 = 포크할 Studio). `mockup.html`은 "메신저 UX 레이어 디자인 타깃"으로 역할 변경(정본 아님).
