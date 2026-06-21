/**
 * HermesTalk — 그룹방 @mention 유틸 (Phase 4 do, 모델 무관)
 *
 * 그룹방에서 특정 서브봇/역할을 `@name`으로 지목한다. composer 텍스트 끝의
 * `@query` 토큰을 감지해 후보 메뉴를 띄우고, 선택 시 `@name `으로 치환한다.
 * (chat-composer의 readSlashCommandQuery와 동일한 경량 패턴, 순수 함수라 단위검증.)
 */

const MENTION_TOKEN = /(^|\s)@([A-Za-z0-9_\-:.]*)$/

/**
 * 텍스트 끝에 있는 `@query` 토큰의 query를 반환. 없으면 null.
 * 빈 query(`@`만 친 직후)는 빈 문자열을 반환(메뉴 오픈 트리거).
 */
export function readMentionQuery(value: string): string | null {
  const match = MENTION_TOKEN.exec(value)
  if (!match) return null
  return match[2]
}

/** 후보명들을 query(대소문자 무시 prefix/포함)로 필터. */
export function filterMentionCandidates(
  candidates: Array<string>,
  query: string,
): Array<string> {
  const q = query.trim().toLowerCase()
  if (!q) return candidates
  return candidates.filter((name) => name.toLowerCase().includes(q))
}

/**
 * 텍스트 끝의 `@query`를 `@name `(뒤 공백 포함)으로 치환.
 * 트리거 토큰이 없으면 `@name `을 끝에 덧붙인다.
 */
export function applyMention(value: string, name: string): string {
  if (MENTION_TOKEN.test(value)) {
    return value.replace(MENTION_TOKEN, (_m, lead: string) => `${lead}@${name} `)
  }
  const needsSpace = value.length > 0 && !/\s$/.test(value)
  return `${value}${needsSpace ? ' ' : ''}@${name} `
}

/** 텍스트에서 멘션된 이름들을 추출(중복 제거, 순서 유지). */
export function extractMentions(value: string): Array<string> {
  const out: Array<string> = []
  const seen = new Set<string>()
  const re = /(?:^|\s)@([A-Za-z0-9_\-:.]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(value)) !== null) {
    const name = m[1]
    if (!seen.has(name)) {
      seen.add(name)
      out.push(name)
    }
  }
  return out
}
