import { beforeEach, describe, expect, it } from 'vitest'
import { isUnlocked, passedCount, useProgress } from './progress'

const ORDER = ['u01', 'u02', 'u03']

describe('progress store', () => {
  beforeEach(() => useProgress.getState().reset())

  it('opens only the first unit at the start', () => {
    const { units } = useProgress.getState()
    expect(isUnlocked(units, ORDER, 'u01')).toBe(true)
    expect(isUnlocked(units, ORDER, 'u02')).toBe(false)
    expect(isUnlocked(units, ORDER, 'nope')).toBe(false)
  })

  it('keeps the next unit locked after a failed attempt', () => {
    useProgress.getState().recordAttempt('u01', 0.6, false)
    const { units } = useProgress.getState()
    expect(units.u01).toMatchObject({ attempts: 1, best: 0.6, passed: false })
    expect(isUnlocked(units, ORDER, 'u02')).toBe(false)
  })

  it('opens exactly one more unit on a pass and never relocks it', () => {
    const { recordAttempt } = useProgress.getState()
    recordAttempt('u01', 0.9, true)
    recordAttempt('u01', 0.3, false)
    const { units } = useProgress.getState()
    expect(units.u01).toMatchObject({ attempts: 2, best: 0.9, passed: true })
    expect(isUnlocked(units, ORDER, 'u02')).toBe(true)
    expect(isUnlocked(units, ORDER, 'u03')).toBe(false)
    expect(passedCount(units, ORDER)).toBe(1)
  })

  it('records each leaf once and does not mutate earlier state', () => {
    const before = useProgress.getState().units
    useProgress.getState().completeLeaf('u01', 'a')
    useProgress.getState().completeLeaf('u01', 'a')
    useProgress.getState().completeLeaf('u01', 'b')
    expect(useProgress.getState().units.u01.leaves).toEqual(['a', 'b'])
    expect(before).toEqual({})
  })
})
