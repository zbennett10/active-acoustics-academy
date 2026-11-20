import { Suspense, memo, type ReactElement, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { visit } from 'unist-util-visit'
import { PLAYGROUNDS } from '../playgrounds/registry'

interface DirectiveNode {
  type: string
  name?: string
  value?: string
  attributes?: Record<string, string | null | undefined> | null
  children?: unknown[]
  data?: { hName?: string; hProperties?: Record<string, unknown> }
}

const CALLOUTS: Record<string, string> = {
  pipeline: 'In the pipeline',
  operator: 'Operator’s view',
  pitfall: 'Pitfall',
  key: 'Key idea',
  scenario: 'Scenario',
  math: 'Math note',
  try: 'Try it',
}

/** Maps :::callout blocks and ::play embeds to elements, and restores stray ":word" text. */
function directives() {
  return (tree: unknown): void => {
    visit(tree as Parameters<typeof visit>[0], (node) => {
      const n = node as unknown as DirectiveNode
      if (n.type === 'containerDirective') {
        n.data = { hName: 'aside', hProperties: { className: ['callout', `callout-${n.name}`], 'data-kind': n.name } }
      } else if (n.type === 'leafDirective' && n.name === 'play') {
        n.data = {
          hName: 'div',
          hProperties: { className: ['play-slot'], 'data-play': n.attributes?.id ?? '', 'data-preset': n.attributes?.preset ?? '' },
        }
      } else if (n.type === 'textDirective') {
        n.type = 'text'
        n.value = `:${n.name ?? ''}`
        n.children = undefined
      }
    })
  }
}

export function PlaygroundEmbed({ id, preset }: { id: string; preset?: string }): ReactElement | null {
  const Comp = PLAYGROUNDS[id]
  if (!Comp) return null
  return (
    <Suspense fallback={<div className="pg pg-loading">Loading playground</div>}>
      <Comp preset={preset || undefined} />
    </Suspense>
  )
}

function makeComponents(playgroundId: string | undefined): Components {
  return {
    aside({ children, ...rest }) {
      const kind = String((rest as Record<string, unknown>)['data-kind'] ?? 'key')
      return (
        <aside className={`callout callout-${kind}`}>
          <div className="callout-label">{CALLOUTS[kind] ?? kind}</div>
          {children as ReactNode}
        </aside>
      )
    },
    div({ children, className, ...rest }) {
      const data = rest as Record<string, unknown>
      if (data['data-play'] !== undefined) {
        const id = String(data['data-play'] || playgroundId || '')
        return (
          <div className="play-slot">
            <PlaygroundEmbed id={id} preset={String(data['data-preset'] ?? '')} />
          </div>
        )
      }
      return <div className={className}>{children as ReactNode}</div>
    },
    a({ children, href }) {
      const external = /^https?:/.test(href ?? '')
      return (
        <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
          {children as ReactNode}
        </a>
      )
    },
  }
}

interface MarkdownProps {
  source: string
  playgroundId?: string
  className?: string
}

function MarkdownImpl({ source, playgroundId, className }: MarkdownProps): ReactElement {
  return (
    <div className={className ?? 'prose'}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath, remarkDirective, directives]} rehypePlugins={[rehypeKatex]} components={makeComponents(playgroundId)}>
        {source}
      </ReactMarkdown>
    </div>
  )
}

export const Markdown = memo(MarkdownImpl)
