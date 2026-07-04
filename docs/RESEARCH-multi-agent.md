# 리서치 — 멀티에이전트 오케스트레이션: 무엇을 언제 쓰나 (2026-07)

> 목적: HermesTalk/Hermes로 멀티에이전트를 구성할 때 "남들이 실제로 쓰는 방식"과
> **모델 등급(SOTA vs 약한 오픈웨이트)** 에 따른 최적 전략 정리. 개인(집) + 회사 적용 둘 다 고려.

## 1. 프레임워크 지형 (2026)
| 프레임워크 | 포지션 |
|---|---|
| **LangGraph** | 프로덕션 배포 1위. 그래프+조건분기, 세밀한 제어·상태관리·체크포인트 |
| **CrewAI** | 역할 기반 crew, 학습 쉬움·프로토타입 최강, 프로덕션 관측성 약함 |
| **AutoGen/AG2** | 대화형 GroupChat, 연구/학계, 토론·검증 패턴 성숙 |
| OpenAI Agents SDK / Claude Code subagents / Cursor | 코딩 도구가 subagent 내장하는 흐름 |

## 2. 오케스트레이션 패턴
- **Orchestrator-Worker** — 프로덕션 최다. 하나가 분해·fan-out·취합. = Hermes `delegate_task`(방식 A), Claude Code subagents.
- **Sequential Pipeline** — 순서 고정, 앞 출력→다음 입력. = **architect→designer→coder→reviewer→reporter**. = Hermes 칸반 핸드오프(방식 B).
- **Hierarchical** — 감독의 감독. 계획이 한 컨텍스트에 안 담길 만큼 클 때. = Paperclip류(조직도).
- **Swarm/Mesh** — 분산·P2P. 특수.
- 실무는 하이브리드(상위 supervisor가 하위 파이프라인 선택)가 흔함.

## 3. 핵심 논쟁 — 단일 vs 멀티 (모델 등급이 좌우)

### 3-A. SOTA 모델 (Opus/Sonnet/GPT-5.5)
- **강한 단일 에이전트 + 도구/검증 루프 + 온디맨드 subagent** 가 정석.
- 단일 성능이 오를수록 에이전트 추가 이득 감소, 일정 수준(예 SWE-bench 45%↑) 넘으면 **오히려 악화**.
- 멀티가 이기는 건 **병렬화/분해 가능 작업**(예: Anthropic 리서치 시스템 리드+병렬 서브에이전트 → 단일 대비 +90%, 단 이건 병렬 "검색" 작업).
- 결론: 선형 코딩 5역할 조립라인은 "정식 패턴이지만 주류는 아님". 조율비용(지연·비용·유지보수) > 이득인 경우 많음.

### 3-B. 약한 오픈웨이트 모델 (Gemma/Qwen/MiMo/Kimi/GLM) ← 회사용
- **결정적 사실: 신뢰도는 복리로 곱해진다.** 스텝당 90% → 5스텝 0.9⁵≈**59%**. 약한 모델에 **긴 자율 루프**를 주면 급격히 붕괴.
- 그래서 SOTA와 **정반대** 전략:

| 항목 | SOTA | 약한 오픈모델 |
|---|---|---|
| 자율성 | 많이 부여 | **최소화**(순서를 코드로 고정) |
| 추론 체인 | 길어도 OK | **짧게**, 스텝마다 좁게 |
| 구조 | 단일+가끔 위임 | **역할 분해 + 검증 게이트 필수** |

- **약한 모델 정석 원칙**:
  1. **결정적 워크플로우 > 자율 에이전트** — "다음에 뭐 할지"를 LLM이 정하게 두지 말 것. LLM은 각 칸의 좁은 일만.
  2. **작게 분해** — 1 호출 = 1 책임. 약한 모델은 좁은 과제엔 강함.
  3. **스텝 사이 검증 게이트** — 스키마 검증·테스트·리뷰어 에이전트·self-consistency(다수결). 약한 모델은 틀리므로 중간 체크가 이득을 만든다.
  4. **체인 짧게 + 재시도 + 휴먼 체크포인트** — 복리 손실 최소화.
  5. **구조화 출력 + tool-calling 안정 모델** — Kimi K2.6(recoverable failure·일관 tool calling) 호평, Qwen/GLM 격차 축소. "믿을 수 있는 가장 작은 모델".
  6. **모델 라우팅** — 쉬운 스텝은 더 작은 모델, 어려운 스텝만 큰 오픈모델.

## 4. 결론 / 우리 적용 기준
| 시나리오 | 추천 |
|---|---|
| **집 + SOTA** | 단일 강 에이전트 + `delegate_task`(방식 A) + 리뷰 루프. 설치 부담 없음 |
| **회사 + 약한 오픈모델(보안·비용)** | **좁게 분해한 역할 파이프라인 + 스텝별 검증 + 짧은 체인 + 강 tool-calling 모델** (방식 B 칸반 / Paperclip으로 프로세스 고정). self-host |
| 공통 주의 | 약한 모델 하나에 긴 자율 코딩 통째 위임 = 지양(복리 붕괴). "자율 스웜"이 아니라 "결정적 워크플로우+검증" |

→ **회사용 다음 PoC**: 약한 오픈모델 1개 물려서 "좁은 역할 + 검증 게이트" 파이프라인(방식 B). 그게 회사에서 실제 돌릴 형태.

## Sources
- Presenc AI — Multi-Agent Orchestration Frameworks 2026: https://presenc.ai/research/multi-agent-orchestration-frameworks-2026
- DEV — LangGraph vs CrewAI vs AutoGen 2026: https://dev.to/pockit_tools/langgraph-vs-crewai-vs-autogen-the-complete-multi-agent-ai-orchestration-guide-for-2026-2d63
- Google Cloud — Choose a design pattern for agentic AI (workflow vs agent): https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system
- IDE — Agent Orchestration Patterns (Swarm/Mesh/Hierarchical/Pipeline): https://ide.com/agent-orchestration-patterns-swarm-vs-mesh-vs-hierarchical-vs-pipeline/
- beam.ai — 6 Multi-Agent Orchestration Patterns for Production: https://beam.ai/agentic-insights/multi-agent-orchestration-patterns-production
- Towards Data Science — Single-Agent vs Multi-Agent: When to Build: https://towardsdatascience.com/single-agent-vs-multi-agent-when-to-build-a-multi-agent-system/
- Anthropic — 2026 Agentic Coding Trends Report: https://resources.anthropic.com/hubfs/2026%20Agentic%20Coding%20Trends%20Report.pdf
- MindStudio — Open-source vs closed-source for agentic workflows (reliability compounds): https://www.mindstudio.ai/blog/open-source-vs-closed-source-ai-models-agentic-workflows
- MindStudio — Best Open-Source LLMs for Agentic Coding 2026: https://www.mindstudio.ai/blog/best-open-source-llms-agentic-coding-2026
- Pinggy — Best Open-Source Self-Hosted LLMs for Coding 2026: https://pinggy.io/blog/best_open_source_self_hosted_llms_for_coding/
