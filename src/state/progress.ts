import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface UnitProgress {
  leaves: string[]
  best: number
  passed: boolean
  attempts: number
}

export const EMPTY_PROGRESS: UnitProgress = { leaves: [], best: 0, passed: false, attempts: 0 }

interface ProgressState {
  units: Record<string, UnitProgress>
  completeLeaf: (unitId: string, leafId: string) => void
  recordAttempt: (unitId: string, score: number, passed: boolean) => void
  reset: () => void
}

export const STORAGE_KEY = 'active-acoustics-academy-v1'

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      units: {},
      completeLeaf: (unitId, leafId) =>
        set((state) => {
          const prev = state.units[unitId] ?? EMPTY_PROGRESS
          if (prev.leaves.includes(leafId)) return state
          return { units: { ...state.units, [unitId]: { ...prev, leaves: [...prev.leaves, leafId] } } }
        }),
      recordAttempt: (unitId, score, passed) =>
        set((state) => {
          const prev = state.units[unitId] ?? EMPTY_PROGRESS
          const next: UnitProgress = {
            ...prev,
            attempts: prev.attempts + 1,
            best: Math.max(prev.best, score),
            passed: prev.passed || passed,
          }
          return { units: { ...state.units, [unitId]: next } }
        }),
      reset: () => set({ units: {} }),
    }),
    { name: STORAGE_KEY, version: 1 },
  ),
)

/** A unit opens when it is first, or when the one before it has been passed. */
export function isUnlocked(units: Record<string, UnitProgress>, order: readonly string[], unitId: string): boolean {
  const i = order.indexOf(unitId)
  if (i <= 0) return i === 0
  return units[order[i - 1]]?.passed === true
}

export function passedCount(units: Record<string, UnitProgress>, order: readonly string[]): number {
  return order.filter((id) => units[id]?.passed).length
}
