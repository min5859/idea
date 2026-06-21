# Design — Phase 4: 그룹방 위임 (방식 A)

## Context Anchor
(Plan 참조) 단일 게이트웨이 내 위임(방식 A)을 `/v1/runs`로 트리거, SSE의 delegate_task를 시간순 말풍선으로. 모델 재인증 후 do/check.

## 아키텍처 옵션
- **A. 별도 그룹방 화면 신규**: `/group/$leader` 신규 라우트+컴포넌트. 격리 깔끔하나 Studio chat 자산(말풍선·composer·스트리밍) 재구현 → 침습/중복 큼. 기각.
- **B. chat 화면에 group 모드 확장 (선택)**: 기존 `/chat/$sessionKey`에 "group" 세션 종류를 더해, 전송을 `/api/hermes-runs`로 라우팅하고 events SSE를 기존 메시지 스트림에 머지. delegate_task는 이미 있는 message-item 카드를 "위임 말풍선"으로 재스타일. @mention은 기존 SlashCommandMenu 패턴 재사용. **최소 침습 + 자산 재사용.**
- **C. Conductor 확장**: office-view 관제 대시보드라 메신저 흐름과 성격 다름 → 보조 뷰로 유지(CLAUDE 지침). 기각.

→ **B 선택.**

## 변경 사항 (do 단계, 모델 재인증 후 실측 기반 확정)
### 1. 그룹방 세션 구분
- `chat-ui.ts`/세션 타입에 `mode: 'chat' | 'group'` 또는 friendlyId 접두(`group:`)로 구분. 사이드바 Agents에서 "그룹방으로 열기" 액션.
- group 세션은 전송을 sessions/send 대신 `/api/hermes-runs`로.

### 2. 위임 이벤트 구독·렌더
- 신규 훅 `use-run-events.ts`: `POST /api/hermes-runs`로 run 생성 → `EventSource('/api/hermes-runs/{id}/events')` 구독.
- 파서: `data: {event:...}` lifecycle(run.created/completed/failed) + `response.output_item.added/done`의 function_call(name=="delegate_task") + output_text.delta. **실제 캡처로 필드 확정 후 구현**(현재 run.failed만 실측).
- 렌더: delegate_task → 위임 말풍선(리더가 워커 N에게), 워커 delta/결과 → 워커 말풍선, 최종 텍스트 → 리더 취합. 기존 `message-item.tsx` 👥 카드 재활용·재스타일.

### 3. @mention
- `chat-composer.tsx`에 `@` 트리거 메뉴(SlashCommandMenu 패턴). 후보 = 역할/워커명(또는 발견된 에이전트). 선택 시 텍스트에 `@name` 주입 → run input의 위임 힌트로 전달.

## 검증 계획 (real, 모델 재인증 후)
- L1: delegating 프롬프트로 `/v1/runs` → events에서 delegate_task function_call 1+ 캡처(스크래치 캡처 파일로 형태 확정).
- L2: 그룹방 UI에서 전송 → 위임 말풍선이 시간순 렌더.
- 빌드: tsc 0에러, vite 트랜스폼 200.

## 리스크
- 위임 이벤트 형태가 문서와 다르면 파서 조정(캡처 선행으로 완화).
- group/normal 세션 혼선 → 명확한 구분자 + 사이드바 라벨.

## 상태
- **do/check 블로커**: 모델(Codex) 재인증 필요(`codex` → `hermes auth`). 재인증 즉시 위임 캡처 → 파서 확정 → 구현·검증.
