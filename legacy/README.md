# legacy/ — 옛 from-scratch 계획의 잔재 (미사용)

여기 파일들은 **HermesTalk를 0부터 Next.js로 만들던 시절의 코드**다.
방향이 **Hermes Studio 포크 + 메신저 UX 레이어**로 바뀌면서 더는 쓰지 않는다.
실제 코드 정본은 포크할 Studio 코드베이스다. (배경: `CLAUDE.md`)

- `agents.ts` — 하드코딩 8봇 + `HERMES_MODE` 토글. 지금은 게이트웨이 자동 감지(probeGateway)로 대체.
- `skills.ts` — 스킬 하드코딩 폴백. 지금은 `/v1/skills` + Studio 화면.
- `types.ts` — from-scratch 어댑터 타입(`live`/mock 이벤트). 지금은 Studio 타입 사용.

참고용으로만 남겨둔다. 필요 없어지면 삭제해도 된다.
