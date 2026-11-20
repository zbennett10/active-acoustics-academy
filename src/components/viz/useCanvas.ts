import { useEffect, useRef, useState, type DependencyList, type RefObject } from 'react'

export type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number) => void

function fit(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; w: number; h: number } | null {
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  if (w === 0 || h === 0) return null
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, w, h }
}

/** Redraws when deps change or the canvas resizes. */
export function useCanvas(draw: DrawFn, deps: DependencyList): RefObject<HTMLCanvasElement | null> {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const drawRef = useRef(draw)
  drawRef.current = draw

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const render = (): void => {
      const f = fit(canvas)
      if (f) drawRef.current(f.ctx, f.w, f.h)
    }
    render()
    const ro = new ResizeObserver(render)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, deps)

  return ref
}

export type FrameFn = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Runs a draw loop while mounted and visible. t is seconds since start. */
export function useAnimatedCanvas(draw: FrameFn, running = true, stillAt = 2): RefObject<HTMLCanvasElement | null> {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const drawRef = useRef(draw)
  drawRef.current = draw

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    let raf = 0
    let visible = true
    let elapsed = 0
    let last = performance.now()
    const still = prefersReducedMotion() || !running

    const frame = (now: number): void => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (visible) {
        elapsed += dt
        const f = fit(canvas)
        if (f) drawRef.current(f.ctx, f.w, f.h, still ? stillAt : elapsed)
      }
      if (!still) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const io = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting)
    })
    io.observe(canvas)
    const ro = new ResizeObserver(() => {
      if (still) requestAnimationFrame(frame)
    })
    ro.observe(canvas)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
    }
  }, [running, stillAt])

  return ref
}

export interface DragHandlers {
  onDown?: (x: number, y: number) => boolean | void
  onMove?: (x: number, y: number, dragging: boolean) => void
  onUp?: () => void
}

/** Pointer handling in canvas CSS pixels. onDown returns true to start a drag. */
export function usePointer(ref: RefObject<HTMLCanvasElement | null>, handlers: DragHandlers): void {
  const hRef = useRef(handlers)
  hRef.current = handlers

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let dragging = false
    const pos = (e: PointerEvent): [number, number] => {
      const r = el.getBoundingClientRect()
      return [e.clientX - r.left, e.clientY - r.top]
    }
    const down = (e: PointerEvent): void => {
      const [x, y] = pos(e)
      if (hRef.current.onDown?.(x, y)) {
        dragging = true
        el.setPointerCapture(e.pointerId)
        e.preventDefault()
      }
    }
    const move = (e: PointerEvent): void => {
      const [x, y] = pos(e)
      hRef.current.onMove?.(x, y, dragging)
    }
    const up = (e: PointerEvent): void => {
      if (dragging) {
        dragging = false
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
        hRef.current.onUp?.()
      }
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [ref])
}

/** Runs 0 to 1 over a duration each time deps change. Used to sweep drawings in. */
export function useReveal(deps: DependencyList, ms = 1300): number {
  const [p, setP] = useState(prefersReducedMotion() ? 1 : 0)
  useEffect(() => {
    if (prefersReducedMotion()) {
      setP(1)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number): void => {
      const v = Math.min(1, (now - start) / ms)
      setP(v)
      if (v < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, deps)
  return p
}
