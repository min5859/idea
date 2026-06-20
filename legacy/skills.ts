import type { AgentId, Skill } from '@/lib/types';

// 폴백용 스킬 목록(리눅스 드라이버 업무 기반).
// real 게이트웨이가 뜬 에이전트는 GET /v1/skills 응답으로 대체하고,
// 미가동(mock) 에이전트는 이 목록을 그대로 반환한다.
export const SKILLS: Record<AgentId, Skill[]> = {
  driver: [
    { name: 'kbuild',    description: '커널 빌드/모듈' },
    { name: 'dts-edit',  description: '디바이스 트리 편집' },
    { name: 'dma-debug', description: 'DMA 매핑 점검' },
  ],
  design: [
    { name: 'arch-design', description: '아키텍처 설계' },
    { name: 'api-spec',    description: 'API 명세 작성' },
  ],
  impl: [
    { name: 'code-impl', description: '코드 구현' },
    { name: 'refactor',  description: '리팩터링' },
  ],
  review: [
    { name: 'patch-review', description: '패치 리뷰' },
    { name: 'checkpatch',   description: '스타일 검사' },
  ],
  debug: [
    { name: 'kgdb',   description: '커널 디버그' },
    { name: 'ftrace', description: '함수 트레이스' },
    { name: 'crash',  description: '크래시 덤프 분석' },
  ],
  report: [
    { name: 'weekly-report', description: '주간보고 작성' },
    { name: 'jira-sync',     description: '이슈 동기화' },
  ],
  deck: [
    { name: 'slide-gen', description: '슬라이드 생성' },
    { name: 'diagram',   description: '다이어그램 작성' },
  ],
  leader: [
    { name: 'orchestrate', description: '오케스트레이션' },
    { name: 'delegate',    description: '작업 위임' },
  ],
};
