'use client'

import { useSyncExternalStore } from 'react'

/**
 * HermesTalk — 세션별 unread 추적 (Phase 3 메신저 UX)
 *
 * friendlyId → 마지막으로 읽은 시각(lastReadAt). 세션의 `updatedAt`이 lastReadAt보다
 * 크면 unread. 텔레그램 등 외부에서 응답이 와 세션이 갱신되면 웹 사이드바에 unread로
 * 뜬다(세션·메모리 공유 기반). 순수 클라이언트 상태(localStorage), 백엔드 무관.
 */

const STORAGE_KEY = 'hermes.unread.readMap.v1'

let readMap: Record<string, number> = {}
const listeners = new Set<() => void>()
let loaded = false

function ensureLoaded() {
  if (loaded || typeof window === 'undefined') return
  loaded = true
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === 'object') {
        readMap = Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>).filter(
            ([, v]) => typeof v === 'number',
          ) as Array<[string, number]>,
        )
      }
    }
  } catch {
    readMap = {}
  }
}

function persist() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(readMap))
  } catch {
    // ignore quota / serialization errors
  }
}

function emit() {
  for (const listener of listeners) listener()
}

/** 세션을 읽음 처리. ts 미지정 시 현재 시각. 이미 더 최신이면 무시. */
export function markSessionRead(friendlyId: string, ts?: number): void {
  if (!friendlyId) return
  ensureLoaded()
  const next = typeof ts === 'number' ? ts : Date.now()
  if ((readMap[friendlyId] ?? 0) >= next) return
  readMap = { ...readMap, [friendlyId]: next }
  persist()
  emit()
}

function subscribe(listener: () => void): () => void {
  ensureLoaded()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): Record<string, number> {
  ensureLoaded()
  return readMap
}

const SERVER_SNAPSHOT: Record<string, number> = {}

/** lastReadAt 맵 구독 */
export function useReadMap(): Record<string, number> {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT)
}

/** 세션이 unread인지 판정 (active 세션은 호출부에서 제외) */
export function isSessionUnread(
  updatedAt: number | null | undefined,
  reads: Record<string, number>,
  friendlyId: string,
): boolean {
  if (typeof updatedAt !== 'number') return false
  return updatedAt > (reads[friendlyId] ?? 0)
}
