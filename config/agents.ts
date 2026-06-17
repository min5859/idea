import type { Agent, AgentId } from '@/lib/types';

// 특화 에이전트 = Hermes 프로필 = 전용 게이트웨이(별도 포트).
// live:true 로 바꾸고 baseUrl 을 채우면 그 에이전트만 real 호출, 나머지는 mock.
// (요청별 프로필 선택이 불가능하므로 model 필드로 분기하지 않는다)
export const AGENTS: Agent[] = [
  { id: 'leader', name: '팀리더봇',   emoji: '👑', isLeader: true,  live: false /*, baseUrl: 'http://localhost:8643/v1' */ },
  { id: 'driver', name: '드라이버봇', emoji: '🐧', isLeader: false, live: false },
  { id: 'design', name: '설계봇',     emoji: '📐', isLeader: false, live: false },
  { id: 'impl',   name: '구현봇',     emoji: '⌨️', isLeader: false, live: false },
  { id: 'review', name: '리뷰봇',     emoji: '🔍', isLeader: false, live: false },
  { id: 'debug',  name: '디버그봇',   emoji: '🐞', isLeader: false, live: false /*, baseUrl: 'http://localhost:8642/v1' */ },
  { id: 'report', name: '주간보고봇', emoji: '📊', isLeader: false, live: false },
  { id: 'deck',   name: '발표봇',     emoji: '🎤', isLeader: false, live: false },
];

export const AGENTS_BY_ID: Record<AgentId, Agent> =
  Object.fromEntries(AGENTS.map((a) => [a.id, a])) as Record<AgentId, Agent>;

export const LEADER: Agent = AGENTS.find((a) => a.isLeader)!;

/** real 호출 여부: 전역 모드가 real 이고, 그 에이전트가 live 이며 baseUrl 이 있을 때만 */
export function isLive(agent: Agent): boolean {
  return process.env.HERMES_MODE === 'real' && agent.live && !!agent.baseUrl;
}
