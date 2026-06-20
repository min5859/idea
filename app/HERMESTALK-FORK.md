# app/ — HermesTalk 애플리케이션 (Hermes Studio 포크)

이 디렉터리는 **`JPeetz/Hermes-Studio` v1.20.0 (MIT)** 를 베이스로 한 HermesTalk 본체다.
원본 라이선스는 `LICENSE`(MIT) 유지. 우리는 여기에 **메신저 UX 레이어**를 얹는다(배경: 상위 `../CLAUDE.md`).

## 실행
```bash
cd app
corepack prepare pnpm@latest --activate   # pnpm 없으면
pnpm install
pnpm rebuild better-sqlite3 esbuild unrs-resolver   # 네이티브 모듈(allowBuilds 처리됨)
HERMES_API_URL=http://127.0.0.1:8642 HERMES_DEFAULT_MODEL=maccoder pnpm dev   # :3000
```
- 게이트웨이 기본값이 이미 `http://127.0.0.1:8642`라 로컬은 env 없이도 붙는다.
- 다른 PC/원격이면 `HERMES_API_URL`(+ 네트워크 바인딩 시 `HERMES_API_TOKEN`) 지정.

## 포크 시 적용한 변경
- `pnpm-workspace.yaml`: 신버전 pnpm이 `package.json`의 `onlyBuiltDependencies`를 안 읽어 `allowBuilds`로 네이티브 빌드 허용.

## 연결 확인됨 (Phase 1)
- `/api/connection-status` → `{ok:true, mode:"portable", backend:"http://127.0.0.1:8642"}`
- `/api/gateway-status` → capability 자동 감지: chat·models·streaming·jobs=true (sessions/skills/memory/config는 dashboard:9119 쪽이라 portable 모드에선 false)

## 업스트림 추적
원본 변경을 주기적으로 머지할 수 있도록, 우리 변경은 별도 커밋/최소 침습으로 유지한다.
원본: https://github.com/JPeetz/Hermes-Studio
