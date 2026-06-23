# hermes-webui — 실행·사용 가이드 + HermesTalk 비교

> `nesquena/hermes-webui` (로컬: `/Users/wooki/project/git/wk/hermes-webui`)
> Hermes의 **"풀 CLI 패리티" 단일 에이전트 웹 콘솔**. Python `http.server`(stdlib) + 바닐라 JS,
> 프레임워크·빌드 없음. Hermes를 **Python으로 직접 import**(강결합)해서 동작한다.
>
> 이 문서는 webui를 띄워 쓰는 법 + 우리 HermesTalk와의 비교를 정리한 참고 노트다.
> (webui는 외부 프로젝트다. 우리 저장소 코드와 무관 — 같은 Hermes 게이트웨이를 공유해 함께 쓸 수 있어 기록해 둔다.)

---

## 0. 설치 (새 PC / 회사 PC)

공식 권장 = **clone 후 `bootstrap.py` 한 방**. (빌드 없음. Linux/macOS/WSL2. 네이티브 Windows는 미지원 — 커뮤니티 가이드 별도.)

```bash
git clone https://github.com/nesquena/hermes-webui.git hermes-webui
cd hermes-webui
python3 bootstrap.py
```
bootstrap.py가 자동으로: ① Hermes Agent 감지(없으면 공식 installer 실행) → ② WebUI 의존성용 파이썬 환경 생성 → ③ 서버 기동 + `/health` 대기 → ④ 브라우저 열기 → ⑤ 첫 실행 온보딩 마법사(모델/프로바이더 설정).

데몬 운영(상시 가동·로그):
```bash
./ctl.sh start    # 백그라운드, PID ~/.hermes/webui.pid, 로그 ~/.hermes/webui.log
./ctl.sh status   # /restart /stop /logs
```

> 이 Mac(wookiui-Macmini)에는 **이미 설치돼 있다**: `/Users/wooki/project/git/wk/hermes-webui`. 그래서 여기선 설치 단계 없이 바로 실행만 하면 된다(아래 §1).

---

## 1. 실행 (이미 설치된 경우)

> ⚠️ 본 Mac에서는 게이트웨이에 `API_SERVER_KEY`가 걸려 있어, webui가 `hermes_cli`를 직접 import하므로 **Hermes의 venv 파이썬**으로 띄우고 키를 넘겼다. (`bootstrap.py`/`./start.sh`는 파이썬 환경을 자동 탐색하지만, 키 환경변수는 `.env`나 인라인으로 줘야 함.) 기본 포트 **8787**.

```bash
cd /Users/wooki/project/git/wk/hermes-webui
HERMES_WEBUI_PORT=8787 \
HERMES_API_URL=http://127.0.0.1:8642 \
HERMES_WEBUI_GATEWAY_API_KEY=<게이트웨이 API_SERVER_KEY와 동일> \
API_SERVER_KEY=<동일> \
  /Users/wooki/.hermes/hermes-agent/venv/bin/python server.py
```
→ `http://localhost:8787`

- 의존성: `pyyaml`, `cryptography` (Hermes venv에 이미 있음).
- 가벼운 대안: `./start.sh` (셸 런처, 파이썬 자동 탐색) 또는 `python3 bootstrap.py`.
- 원격: `ssh -N -L 8787:127.0.0.1:8787 <user>@<host>` 후 로컬에서 8787 접속.
- 종료: `lsof -nP -tiTCP:8787 -sTCP:LISTEN | xargs kill` (또는 `./ctl.sh stop` — ctl.sh로 띄운 경우만).
- 포트 변경: `HERMES_WEBUI_PORT=9000 ...` (8787은 webui 기본값).

> 현재 포트 맵: 8642/8643/8644 = Hermes 게이트웨이(maccoder/news/trading), 3000 = HermesTalk, 8787 = webui.
> 출처: https://github.com/nesquena/hermes-webui

---

## 2. 화면 구조 (3-패널)
```
왼쪽: 세션·네비 + 패널 탭 + Control Center(하단)
가운데: 채팅 (입력창 하단 composer footer: 프로필·모델·워크스페이스·컨텍스트 링)
오른쪽: 워크스페이스 파일 브라우저 (드래그 리사이즈)
```

## 3. 처음 1분
1. **에이전트 고르기** — composer footer의 **프로필 칩** 클릭 → maccoder/news/trading 선택. 초록 dot = 게이트웨이 running. 서버 재시작 없이 즉시 전환(스킬·메모리·크론까지).
2. **모델 확인** — footer 모델 드롭다운.
3. **첫 메시지** — 입력 후 Enter. 토큰 실시간 스트리밍, footer 원형 링이 컨텍스트 사용량.
4. 예: `news` → "오늘 기술/AI 뉴스 브리핑", `trading` → "ht_trading 로그 분석".

## 4. 핵심 기능
**채팅**: 처리 중 메시지 자동 큐잉, 과거 메시지 인라인 편집 후 재생성, 마지막 답변 재시도, footer Stop으로 취소. Tool 카드 / 서브에이전트 위임 카드 / Thinking 카드 / 위험 명령 승인 카드(once·session·always·deny). 코드 복사, Mermaid 렌더, 첨부 유지.

**세션**(Chat 패널): 생성·이름변경·복제·삭제, 제목+본문 검색, `⋯`로 pin/프로젝트/아카이브, Today/Yesterday/Earlier 그룹. **CLI 세션**은 gold "cli" 뱃지로 떠서 클릭 시 히스토리째 이어쓰기. Markdown/JSON export·import.

**워크스페이스**(오른쪽): 트리·미리보기(텍스트/코드/MD/이미지), 편집·생성·삭제, git 브랜치+변경수 뱃지. 채팅에서 `workspace://경로` 클릭 시 오른쪽에 열림.

**패널 탭**(왼쪽 상단):
- **Tasks** — 크론 잡 보기/생성/실행/일시정지 + 실행 히스토리 + 완료 알림. ← **데일리 뉴스 자동화는 여기서** news 프로필로 잡 생성.
- **Skills** / **Memory**(MEMORY.md·USER.md 인라인 편집) / **Profiles**(생성·전환·삭제·클론) / **Todos** / **Spaces**.

**슬래시 커맨드**(`/`): `/model <이름>`, `/workspace <이름>`, `/new`, `/clear`, `/compress [주제]`, `/usage`, `/theme <테마>`, `/help`. 모르는 건 에이전트로 전달.

**Control Center**(사이드바 하단): Conversation(export/clear) · Preferences(모델·전송키·테마·언어·토글) · System(버전·비밀번호). 전송키 Enter/⌘Enter, 테마(dark/light + skin 여러 종).

## 5. 우리 셋업과 연결
- **데일리 뉴스 자동화** → Tasks 패널에서 news 프로필 cron 잡(매일 N시 4개 분야 브리핑). 완료 토스트+뱃지.
- **트레이딩 분석** → trading 프로필 + 워크스페이스를 `/Users/wooki/project/toy/ht_trading`로.
- **봇 전환** → footer 프로필 칩으로 maccoder↔news↔trading.

## 6. 보안(원격)
로컬은 비밀번호 불필요. 원격 열면 Control Center→System에서 비밀번호 설정, 이후 **passkey(WebAuthn)** 등록 가능. (`HERMES_WEBUI_PASSWORD`로도 설정.)

---

## 7. HermesTalk(우리) vs hermes-webui

| 항목 | hermes-webui | HermesTalk (우리) |
|---|---|---|
| 스택 | Python stdlib http.server + 바닐라 JS | TanStack Start + React + TS (Vite 빌드) |
| Hermes 연결 | `hermes_cli` **직접 import** + subprocess | **HTTP `/v1` 프록시**(:8642) |
| 결합도 | 강결합 — Hermes와 같은 Python 환경 실행 必 | 느슨 — HTTP만 되면 다른 PC/원격 OK |
| 지향 | 단일 에이전트 깊게(콘솔) | **멀티 에이전트 메신저**(agent=채팅방) |
| 칸반 | 네이티브 `kanban_db` **read+write** | 네이티브 `kanban.db` **read 전용** |
| 멀티에이전트 | 프로필 드롭다운 전환(crews/conductor/group **0**) | Agents presence·전환 + **Group Room 위임뷰** + Studio crews/conductor |
| 인증 | password + **WebAuthn(passkeys)** | password + 세션토큰 |
| 빌드/배포 | **빌드 0**(python+js) | Node/pnpm 빌드 |
| 부가 | voice 입력, 커스텀 엔드포인트(Ollama/LMStudio), goals/metering | 메시지 FTS 검색, unread, 게이트웨이 자동발견 |

**둘 다**: sessions, 칸반, unread, 프로필+게이트웨이 상태 dot, tool 카드, 토큰/비용, 테마, 모바일.

**webui가 나은 점**: 빌드 0(배포 가벼움), Hermes 내부 직접 접근으로 칸반 write·goals·metering 등 단일 에이전트 깊이, WebAuthn, voice, 커스텀 엔드포인트. 상류가 활발히 관리 → 유지보수 부담 적음.

**HermesTalk만의 것**: 멀티 에이전트를 채팅방으로(presence·전환), **그룹방 위임 시각화**(방식 A), 느슨한 HTTP 결합(집/회사 PC 분리 구도에 적합). webui엔 crews/conductor/group/multi-agent 개념이 없음.

**판단 가이드**:
- "몇 개 봇을 골라 1:1로 쓰고, 칸반·텔레그램·뉴스 자동화" 위주 → **webui로 충분**(더 성숙·저유지보수).
- "리더가 여러 봇에게 위임하고 그 과정을 메신저처럼 한눈에" → **HermesTalk** 고유 가치.
- 둘은 배타적이지 않음 — 같은 Hermes에 붙으니 **webui를 데일리 드라이버로, 그룹 위임 볼 때만 HermesTalk** 병행 가능.

> 우리가 webui에서 차용 검토할 것: 칸반 read→write, WebAuthn(passkeys), 커스텀 엔드포인트 프로필 생성. (CLAUDE.md §9 방침과 동일 — 코드가 아니라 UX 아이디어 차용.)
