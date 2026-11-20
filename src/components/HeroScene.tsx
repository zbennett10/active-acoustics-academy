import type { ReactElement } from 'react'
import { useAnimatedCanvas } from './viz/useCanvas'

const PERIOD = 7

function seabed(x: number, w: number, h: number): number {
  const u = x / w
  return h * (0.86 - 0.05 * Math.sin(u * 5.1 + 0.6) - 0.035 * Math.sin(u * 13.3) - 0.07 * Math.max(0, u - 0.55))
}

/** Home page backdrop. A ping leaves the ship, finds the target, and an echo comes home. */
export function HeroScene(): ReactElement {
  const ref = useAnimatedCanvas((ctx, w, h, t) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#0a2a3d')
    g.addColorStop(0.45, '#061826')
    g.addColorStop(1, '#03080e')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)

    const src = { x: w * 0.6, y: h * 0.2 }
    const tgt = { x: w * 0.86, y: h * 0.56 }
    const phase = (t % PERIOD) / PERIOD
    const reach = Math.hypot(w, h) * 0.95
    const dTarget = Math.hypot(tgt.x - src.x, tgt.y - src.y)

    // Marine snow gives the water some depth.
    ctx.fillStyle = 'rgba(190,225,240,0.22)'
    for (let i = 0; i < 70; i++) {
      const px = (i * 137.5 + t * (4 + (i % 5))) % w
      const py = (i * 71.3 + t * (6 + (i % 7) * 1.5)) % h
      ctx.fillRect(px, py, 1.2, 1.2)
    }

    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 9; i++) {
      const a = -0.25 + i * 0.09
      ctx.beginPath()
      ctx.moveTo(src.x, src.y)
      for (let s = 0; s <= 60; s++) {
        const x = src.x - (s / 60) * w * 0.62
        const u = s / 60
        const y = src.y + Math.sin(u * Math.PI * (1.1 + i * 0.05)) * h * (0.2 + a) + u * h * 0.06
        ctx.lineTo(x, y)
      }
      ctx.strokeStyle = `rgba(69,224,200,${0.05 + 0.015 * i})`
      ctx.lineWidth = 1
      ctx.stroke()
    }
    ctx.restore()

    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (let k = 0; k < 3; k++) {
      const p = phase - k * 0.035
      if (p <= 0) continue
      const r = p * reach
      const alpha = Math.max(0, 0.5 * (1 - p) - k * 0.1)
      ctx.beginPath()
      ctx.arc(src.x, src.y, r, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(69,224,200,${alpha})`
      ctx.lineWidth = 2.2 - k * 0.5
      ctx.stroke()
    }
    // Echo, once the front has reached the target.
    const hit = dTarget / reach
    if (phase > hit) {
      const p = phase - hit
      for (let k = 0; k < 2; k++) {
        const r = (p - k * 0.03) * reach
        if (r <= 0) continue
        ctx.beginPath()
        ctx.arc(tgt.x, tgt.y, r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255,180,84,${Math.max(0, 0.5 * (1 - p * 2.2))})`
        ctx.lineWidth = 1.8
        ctx.stroke()
      }
      const flash = Math.max(0, 1 - p * 9)
      if (flash > 0) {
        const rg = ctx.createRadialGradient(tgt.x, tgt.y, 0, tgt.x, tgt.y, 70)
        rg.addColorStop(0, `rgba(255,180,84,${0.55 * flash})`)
        rg.addColorStop(1, 'rgba(255,180,84,0)')
        ctx.fillStyle = rg
        ctx.fillRect(tgt.x - 70, tgt.y - 70, 140, 140)
      }
    }
    ctx.restore()

    ctx.beginPath()
    ctx.moveTo(0, 0)
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h * 0.085 + Math.sin(x * 0.02 + t * 0.9) * 2.4 + Math.sin(x * 0.047 - t * 0.6) * 1.4)
    ctx.lineTo(w, 0)
    ctx.closePath()
    ctx.fillStyle = '#0d3145'
    ctx.fill()
    ctx.strokeStyle = 'rgba(160,225,240,0.35)'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(0, h)
    for (let x = 0; x <= w; x += 6) ctx.lineTo(x, seabed(x, w, h))
    ctx.lineTo(w, h)
    ctx.closePath()
    const sg = ctx.createLinearGradient(0, h * 0.7, 0, h)
    sg.addColorStop(0, '#2a2118')
    sg.addColorStop(1, '#0d0a07')
    ctx.fillStyle = sg
    ctx.fill()
    ctx.strokeStyle = 'rgba(138,106,68,0.7)'
    ctx.stroke()

    ctx.fillStyle = '#9fb6c6'
    ctx.beginPath()
    ctx.moveTo(src.x - 34, h * 0.07)
    ctx.lineTo(src.x + 30, h * 0.07)
    ctx.lineTo(src.x + 20, h * 0.1)
    ctx.lineTo(src.x - 26, h * 0.1)
    ctx.closePath()
    ctx.fill()
    ctx.fillRect(src.x - 8, h * 0.045, 14, h * 0.026)
    ctx.strokeStyle = 'rgba(159,182,198,0.5)'
    ctx.beginPath()
    ctx.moveTo(src.x - 20, h * 0.1)
    ctx.lineTo(src.x, src.y)
    ctx.stroke()
    ctx.fillStyle = '#45e0c8'
    ctx.shadowColor = '#45e0c8'
    ctx.shadowBlur = 16
    ctx.beginPath()
    ctx.arc(src.x, src.y, 4.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    ctx.save()
    ctx.translate(tgt.x, tgt.y)
    ctx.fillStyle = '#1a2a38'
    ctx.strokeStyle = 'rgba(255,180,84,0.65)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.ellipse(0, 0, 46, 8.5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.rect(-6, -17, 14, 10)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  })
  return <canvas ref={ref} aria-hidden="true" />
}
