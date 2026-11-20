import type { Branch } from './types'

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Splits a unit file into branches ("# ") and leaves ("## "). */
export function parseUnitMarkdown(raw: string): Branch[] {
  const branches: Branch[] = []
  const used = new Set<string>()
  let body: string[] = []
  let fenced = false

  const flush = (): void => {
    const branch = branches[branches.length - 1]
    const leaf = branch?.leaves[branch.leaves.length - 1]
    if (leaf) leaf.body = body.join('\n').trim()
    body = []
  }
  const unique = (base: string): string => {
    let id = base
    let n = 2
    while (used.has(id)) id = `${base}-${n++}`
    used.add(id)
    return id
  }

  for (const line of raw.split('\n')) {
    if (line.startsWith('```')) fenced = !fenced
    if (!fenced && line.startsWith('# ')) {
      flush()
      const title = line.slice(2).trim()
      branches.push({ id: unique(slugify(title)), title, leaves: [] })
    } else if (!fenced && line.startsWith('## ') && branches.length > 0) {
      flush()
      const title = line.slice(3).trim()
      branches[branches.length - 1].leaves.push({ id: unique(slugify(title)), title, body: '' })
    } else {
      body.push(line)
    }
  }
  flush()
  return branches
}
