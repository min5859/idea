# 업스트림(Hermes Studio) 머지 절차

> HermesTalk는 `JPeetz/Hermes-Studio`(v1.20.0) 포크. 우리 변경은 **레이어/별도 커밋**으로
> 최소 침습하게 얹어 업스트림 머지 여지를 유지한다. (CLAUDE.md §8 원칙)

## 우리가 추가/수정한 표면 (머지 충돌 주시 지점)
- **신규 파일(충돌 거의 없음)**:
  - `src/routes/api/hermestalk/agents.ts`, `active-gateway.ts` (다중 게이트웨이 발견·전환)
  - `src/screens/chat/hooks/use-hermes-agents.ts`
  - `src/screens/chat/components/sidebar/hermes-agents-section.tsx`
  - `src/screens/chat/unread-store.ts`
  - `src/server/native-kanban-store.ts`
- **기존 파일 소폭 수정(머지 시 확인)**:
  - `src/server/gateway-capabilities.ts` — `setActiveGateway/getActiveGateway` 추가
  - `src/screens/chat/components/chat-sidebar.tsx` — Agents 섹션 주입(2줄)
  - `src/screens/chat/components/sidebar/{session-item,sidebar-sessions}.tsx` — unread
  - `src/routes/api/tasks/{index,$taskId}.ts` — 네이티브 칸반 read 분기
  - `app/docker-compose.yml` — restart: unless-stopped

## 절차
```bash
# 1) 업스트림 리모트(최초 1회)
cd app
git remote add upstream https://github.com/JPeetz/Hermes-Studio.git   # 이미 있으면 생략

# 2) 업스트림 페치 + 태그/브랜치 확인
git fetch upstream --tags

# 3) 작업 브랜치에서 머지(또는 rebase). 충돌은 위 "기존 파일 소폭 수정" 위주
git checkout hermestalk-init
git merge upstream/main        # 또는 특정 릴리스 태그

# 4) 충돌 해결 → 빌드 검증
pnpm install
./node_modules/.bin/tsc --noEmit
pnpm dev   # :3000, /api/hermestalk/agents · /api/tasks 동작 확인

# 5) 우리 변경이 살아있는지 스모크
#    - 사이드바 Agents 섹션 + presence
#    - /api/tasks → source: native-kanban
```

## 원칙
- 우리 기능은 가능하면 **신규 파일**로. 기존 파일은 **명확히 구분되는 최소 패치**만.
- 머지 후 `docs/01-plan`·`docs/02-design`의 Phase 문서로 의도 재확인.
- mock 금지 — 머지 후에도 real 게이트웨이로 스모크.
