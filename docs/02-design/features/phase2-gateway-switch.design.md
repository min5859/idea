# Design — Phase 2 완료: 게이트웨이 전환 배선

## Context Anchor
(Plan 참조) 전역 활성 게이트웨이 1개 전환. per-request 스레딩 비목표.

## 아키텍처 옵션 검토
- **A. per-request baseUrl 스레딩**: `sendChat`/history/stream/capabilities 전부에 baseUrl 인자 추가. ~24파일 침습. 동시 멀티룸 가능하나 업스트림 머지 파괴 → 기각.
- **B. 전역 활성 게이트웨이 전환 (선택)**: `HERMES_API`가 live-binding `let`이므로 setter로 재할당하면 모든 importer에 자동 반영. 신규 라우트 1 + setter 1 + 사이드바 클릭. 최소 침습. 단일 사용자 도구에 적합.
- **C. 프론트 프록시 리라이트**: 클라가 baseUrl을 헤더로 → 서버가 동적 프록시. B보다 침습 크고 인증/세션 꼬임.

→ **B 선택** (최소 침습 + live-binding 활용 + 개인 도구 요건 충족).

## 변경 사항
### 1. `src/server/gateway-capabilities.ts`
```ts
export function setActiveGateway(baseUrl: string): void {
  HERMES_API = baseUrl.replace(/\/+$/, '')
  capabilities = { ...capabilities, probed: false } // 다음 ensureGatewayProbed에서 재probe 강제
}
export function getActiveGateway(): string { return HERMES_API }
```
- `capabilities.probed=false`로 만들어 다음 요청의 `ensureGatewayProbed()`가 새 게이트웨이로 재probe.

### 2. 신규 라우트 `src/routes/api/hermestalk/active-gateway.ts`
- GET → `{ baseUrl: getActiveGateway() }`
- POST `{ baseUrl }` → 후보 목록(candidateGateways 재사용)에 속하는지 검증 → `setActiveGateway` → `probeGateway({force:true})` → `{ ok, baseUrl, capabilities }`.
- 검증 실패 시 400(허용되지 않은 baseUrl 차단 — SSRF/오용 방지).

### 3. 사이드바 `hermes-agents-section.tsx` + 훅
- `use-hermes-agents.ts`에 활성 baseUrl 조회 + 전환 mutation 추가(또는 별도 `use-active-gateway.ts`).
- 에이전트 행을 button으로 → 클릭 시 전환 호출 + 활성 행 하이라이트(체크/accent).
- 전환 성공 시 capability 관련 쿼리 무효화(connection-status, gateway-status) → presence/상태 갱신.

## 검증 계획 (real)
- L1: `curl POST /api/hermestalk/active-gateway {baseUrl:8642}` → 200 + baseUrl 반영. 가짜 8643 → 400 또는 probe 실패 처리.
- L1: `curl GET` → 현재 활성 baseUrl.
- 빌드: tsc 0에러, vite 트랜스폼 200.

## 리스크/완충
- 전역 전환이라 진행 중 다른 세션이 있으면 영향. 개인 단일 사용자라 수용. 문서화.
- 전환 직후 첫 요청이 재probe 비용(수백 ms). 수용.
