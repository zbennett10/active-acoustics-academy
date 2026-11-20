export interface Leaf {
  id: string
  title: string
  body: string
}

export interface Branch {
  id: string
  title: string
  leaves: Leaf[]
}

export type UnitTier = 'trunk' | 'limbs' | 'crown'

export interface UnitMeta {
  id: string
  number: number
  title: string
  tier: UnitTier
  kind: 'core' | 'math'
  tagline: string
  objectives: string[]
  playground: string
  playgroundTitle: string
}

export interface Unit extends UnitMeta {
  branches: Branch[]
}

export interface LeafRef {
  unit: Unit
  branch: Branch
  leaf: Leaf
  index: number
}
