# 내일 해커톤 시작 가이드

## 첫 프롬프트 (Claude Code에 그대로 붙여넣기)

> CLAUDE.md랑 TODO.md 읽고 Phase 0부터 순서대로 진행해줘. mockup.html을 UI 정본으로 쓰고, 일단 mock 모드로 5개 데모 기준까지 끝까지 동작시켜줘.

`CLAUDE.md`는 Claude Code가 폴더를 열면 자동으로 읽는다. 위 프롬프트는 TODO 순서·정본·mock 우선을 한 번 더 못박는 용도.

---

## 막히기 쉬운 함정 3개

### 1. `create-next-app` 거부
폴더가 안 비어 있어서(CLAUDE.md, config/, lib/, mockup.html …) `create-next-app .`이 "디렉터리 비어있지 않음"으로 실패한다.
→ **임시 폴더에 스캐폴드 후 생성물을 현재 폴더로 병합**(기존 config/·lib/·*.md·mockup.html·.env.example 유지).
→ TODO Phase 1에 지침을 넣어둬서 에이전트가 알아서 처리한다.

### 2. 네트워크
`npm install`(패키지 다운로드)에 인터넷이 필요하다. 해커톤 망에서 npm registry 접근이 되는지 **미리** 확인.
→ 안 되면 mock UI 구현 자체는 가능하지만 셋업이 막힌다.

### 3. Hermes 서버 도달성 (real용)
Phase 0에서 사내 Hermes 게이트웨이(:8642)에 해커톤 PC가 접근 가능한지가 관건.
→ 안 되면 깔끔하게 mock 데모로 간다 (문서가 그렇게 설계됨).

---

세 함정 모두 **"안 되면 mock으로 완결"**되게 문서가 짜여 있어, 최악의 경우에도 데모는 보장된다.
내일 폴더 그대로 열고 위 첫 프롬프트로 시작하면 된다.
