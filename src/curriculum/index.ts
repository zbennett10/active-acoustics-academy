import { UNIT_META } from './meta'
import { parseUnitMarkdown } from './parse'
import type { LeafRef, Unit } from './types'

const files = import.meta.glob('./units/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export const UNITS: Unit[] = UNIT_META.map((meta) => ({
  ...meta,
  branches: parseUnitMarkdown(files[`./units/${meta.id}.md`] ?? ''),
}))

export const UNIT_ORDER: string[] = UNITS.map((u) => u.id)

export function getUnit(id: string | undefined): Unit | undefined {
  return UNITS.find((u) => u.id === id)
}

export function flattenLeaves(unit: Unit): LeafRef[] {
  return unit.branches.flatMap((branch) => branch.leaves.map((leaf) => ({ unit, branch, leaf }))).map((ref, index) => ({ ...ref, index }))
}

export function leafCount(unit: Unit): number {
  return unit.branches.reduce((n, b) => n + b.leaves.length, 0)
}

export const TOTAL_LEAVES: number = UNITS.reduce((n, u) => n + leafCount(u), 0)
export const TOTAL_BRANCHES: number = UNITS.reduce((n, u) => n + u.branches.length, 0)
