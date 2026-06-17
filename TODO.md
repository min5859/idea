# Hermes Crew — 해커톤 작업 계획 (1~2일)

> 우선순위: ⭐ 필수(데모 코어) / 🔸 권장 / 💎 스트레치(여유 시)
> 각 단계 끝에 **폴백**을 둔다 — 막히면 폴백으로 즉시 전환하고 다음으로 넘어간다.

## Phase 0 — 환경 준비 (Day 1 오전, ~1.5h) ⭐

- [ ] 리눅스 서버에 Hermes Agent 본체 동작 확인 (`hermes gateway status`)
- [ ] 각 프로필 `~/.hermes/profiles/<name>/.env` 에 `API_SERVER_ENABLED=true`·`API_SERVER_KEY=<key>`·`API_SERVER_HOST=0.0.0.0`·`API_SERVER_PORT=<고유>`
- [ ] 각 프로필 API 서버 기동: `hermes -p driver gateway &` · `hermes -p reviewer gateway &` … (gateway 가 API 서버 포함)
- [ ] `curl http://서버IP:<port>/v1/models -H "Authorization: Bearer <key>"` → 각 포트 응답 확인
- [ ] **윈도우 PC 에서 각 포트 응답 확인** (브라우저/curl) ← 막히면 모든 게 막힘. 최우선 검증.
- [ ] `.env.example`·`agents.config.example.json` 복사해 사내값 채우기 / `.gitignore` 적용 확인
- 폴백: 0.0.0.0 가 방화벽에 막히면 → SSH 포트포워딩(`ssh -L 8642:127.0.0.1:8642`)으로 우회. 데모는 "브라우저로 쓴다"가 핵심이라 터널이라도 OK.

## Phase 1 — 직무 특화 에이전트 프로필 (Day 1 오후, ~2h) ⭐

- [ ] `driver` / `reviewer` / `report` 3개 프로필 생성 (`hermes profile create <name> --clone`)
- [ ] 각 프로필 `SOUL.md` 페르소나 작성 (driver=시니어 드라이버 엔지니어, reviewer=깐깐한 패치 리뷰어, report=문서 요약가)
- [ ] 각 프로필 API 서버가 자기 포트로 `/v1/chat/completions` 응답 검증 → **포트·model명을 `agents.config.json` 에 기록**
- [ ] (여유) `architect` / `brainstorm` 추가
- 폴백: 프로필 3개까지만. 5개 욕심내다 시간 날리지 말 것.

## Phase 2 — 동시 멀티채팅 프론트 구현 (Day 1 밤~Day 2 오전, ~4h) ⭐ 핵심 기여

- [ ] 백엔드 래퍼(필수, `SPEC.md` §5 계약): `POST /api/chat/{profile}` 프록시(키 주입·SSE 패스스루) + `GET /api/agents`. 키는 백엔드에만.
- [ ] `mockup.html` → `frontend/`: `send()` 를 `/api/chat/{profile}` 호출 + **SSE 파싱**(delta 누적)으로 교체. `messages` 누적 + `X-Hermes-Session-Key` 적용
- [ ] 사이드바 목록·상태를 `GET /api/agents` 결과로 채우기 (하드코딩 → 실데이터)
- [ ] 프로필별 대화 **세션 분리** (독립 messages 배열·독립 대화창)
- 폴백: 백엔드 래퍼가 막히면 → 프론트 직접 호출(데모 한정, 키 노출 감수) + 상태 수동 표기. (CORS 필요 시 서버 `API_SERVER_CORS_ORIGINS` 설정)

## Phase 3 — 주간보고 자동 생성 (Day 2 오전, ~2h) ⭐ 킬러 기능

- [ ] `POST /api/report` 구현 — report(또는 lead) 프로필에 고정 프롬프트 호출
- [ ] 입력원: 각 프로필이 `X-Hermes-Session-Key` 로 누적한 메모리 활용 (폴백: 세션 로그 수동 첨부)
- [ ] 프롬프트: "완료/진행/Blocker 분류 + `[프로필명]` 표기 + 보고체 마크다운"
- [ ] 프론트 "주간보고 생성" 버튼 → `POST /api/report` 결과를 모달에 렌더
- 폴백: 자동 집계가 어려우면 → 세션 로그를 수동으로 붙여넣어 요약하는 형태라도 데모 성립.

## Phase 4 — 데모 리허설 + 발표 (Day 2 오후, ~2h) ⭐

- [ ] 데모 시나리오 순서대로 1회 완주 리허설 (CLAUDE.md "데모 성공 기준" 5단계)
- [ ] 끊기는 지점 / 로딩 느린 지점 체크 → 데모용으로 미리 워밍업
- [ ] 발표자료(PROPOSAL.md) 슬라이드 변환 (Marp/Slidev) 또는 그대로 화면 공유
- [ ] 백업: 시연 실패 대비 화면 녹화(gif/mp4) 1개 미리 확보

## Phase 5 — 오케스트레이션 (스트레치) 💎

- [ ] `lead` 프로필 = role orchestrator + `delegate_task` 스킬 enable
- [ ] **API 경유 위임 동작 당일 검증** (SPEC §0): lead 에 메시지 → 내부 delegate 발생/취합 확인
- [ ] (되면) 응답 스트림의 `hermes.tool.progress` 이벤트로 delegation 카드 표시
- 폴백: API 경유 위임이 안 되면 → 발표에서 "향후 방향"으로만 언급. 무리하게 구현 안 한다.

---

## 리스크 한눈에

| 리스크 | 대응 |
|---|---|
| 사내망 포트 차단 | SSH 포트포워딩 폴백 (Phase 0) |
| 멀티채팅 프론트 시간 초과 | 사이드바 + 순차 전환(1개씩)이라도 데모 성립 (Phase 2) |
| delegate_task API 미작동 | 오케스트레이션은 발표 언급만 (Phase 5, 스트레치) |
| 주간보고 자동 집계 실패 | 수동 입력 요약 폴백 (Phase 3) |
| 시연 중 라이브 실패 | 사전 녹화 백업 (Phase 4) |
