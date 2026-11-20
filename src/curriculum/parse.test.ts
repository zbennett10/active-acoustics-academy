import { describe, expect, it } from 'vitest'
import { parseUnitMarkdown, slugify } from './parse'

const SAMPLE = `# First branch

## Leaf one

Body of one.

\`\`\`
# not a heading inside a fence
\`\`\`

## Leaf two

Body of two.

# Second branch

## Leaf one

Same title, different branch.
`

describe('unit markdown parser', () => {
  it('splits branches and leaves and keeps bodies', () => {
    const branches = parseUnitMarkdown(SAMPLE)
    expect(branches.map((b) => b.title)).toEqual(['First branch', 'Second branch'])
    expect(branches[0].leaves.map((l) => l.title)).toEqual(['Leaf one', 'Leaf two'])
    expect(branches[0].leaves[0].body).toContain('Body of one.')
    expect(branches[0].leaves[0].body).toContain('# not a heading inside a fence')
    expect(branches[1].leaves[0].body).toBe('Same title, different branch.')
  })

  it('gives every branch and leaf a unique id', () => {
    const branches = parseUnitMarkdown(SAMPLE)
    const ids = branches.flatMap((b) => [b.id, ...b.leaves.map((l) => l.id)])
    expect(new Set(ids).size).toBe(ids.length)
    expect(branches[1].leaves[0].id).toBe('leaf-one-2')
  })

  it('handles empty input and slugs', () => {
    expect(parseUnitMarkdown('')).toEqual([])
    expect(slugify('D/E: Depression & Elevation!')).toBe('d-e-depression-elevation')
  })
})
