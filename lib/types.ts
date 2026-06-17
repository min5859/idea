// HermesTalk 공통 타입 (mockup.html 데이터 형태와 일치)

export type AgentId =
  | 'leader' | 'driver' | 'design' | 'impl'
  | 'review' | 'debug' | 'report' | 'deck';

export interface Agent {
  id: AgentId;
  name: string;
  emoji: string;
  isLeader: boolean;
  /** 전용 Hermes 게이트웨이가 떠 있으면 true → real 호출, 아니면 mock */
  live: boolean;
  /** 프로필=게이트웨이=포트. live 일 때 해당 게이트웨이 baseUrl (예: http://host:8642/v1) */
  baseUrl?: string;
}

export type Presence = 'online' | 'busy' | 'idle';

export interface Skill {
  name: string;        // 예: 'kbuild'
  description: string; // 1줄 설명
}

/** 채팅 메시지 (어댑터 입력) */
export interface Msg {
  role: 'user' | 'agent';
  text: string;
}

/** 어댑터가 내보내는 스트리밍 이벤트 (real/mock 공통) */
export type HermesEvent =
  | { type: 'token'; text: string }
  | { type: 'delegation'; agent: string; status: string }
  | { type: 'done' };

/** 칸반 */
export type Lane = 'Backlog' | 'To Do' | 'In Progress' | 'Review' | 'Done';
export const LANES: Lane[] = ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'];

export interface Task {
  id: string;
  title: string;
  detail: string;
  lane: Lane;
  who?: AgentId; // claim 한 에이전트
}
