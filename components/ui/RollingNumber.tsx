'use client'
import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'

// Slot-machine / odometer number. Each digit is an independent drum that scrolls
// up through several full 0-9 cycles and decelerates onto its target with a
// slight overshoot. Higher place-value digits spin longer and start a touch
// earlier, so the reels settle right-to-left (leftmost lands last).
//
// Fires on mount (so it replays whenever the page is navigated to / remounted)
// and whenever the value changes. Static chars ($ , . k % + −) don't animate.
//
// `gradient` paints each glyph with a background-clip:text gradient — applied
// per-cell so the drums' overflow:hidden doesn't clip the fill away.

const SPINS = 3            // extra full rotations before landing
const CELL_EM = 1.12       // digit cell height, relative to font-size
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

function glyphStyle(gradient?: string): CSSProperties {
  if (!gradient) return {}
  return {
    background: gradient,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    color: 'transparent',
  }
}

function Drum({ digit, duration, delay, gradient }: { digit: number; duration: number; delay: number; gradient?: string }) {
  const reelRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const reel = reelRef.current
    if (!reel) return
    const targetY = (SPINS * 10 + digit) * CELL_EM

    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      reel.style.transition = 'none'
      reel.style.transform = `translateY(-${targetY}em)`
      return
    }

    // Reset to the top instantly, force a reflow, then animate down to target.
    reel.style.transition = 'none'
    reel.style.transform = 'translateY(0)'
    void reel.offsetHeight
    const id = requestAnimationFrame(() => {
      reel.style.transition = `transform ${duration}ms ${EASE} ${delay}ms`
      reel.style.transform = `translateY(-${targetY}em)`
    })
    return () => cancelAnimationFrame(id)
  }, [digit, duration, delay])

  const g = glyphStyle(gradient)
  return (
    <span style={{ display: 'inline-block', height: `${CELL_EM}em`, overflow: 'hidden', verticalAlign: 'top' }}>
      <span ref={reelRef} style={{ display: 'block', willChange: 'transform' }}>
        {Array.from({ length: (SPINS + 1) * 10 }, (_, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: `${CELL_EM}em`, ...g }}>
            {i % 10}
          </span>
        ))}
      </span>
    </span>
  )
}

export function RollingNumber({ value, gradient }: { value: string; gradient?: string }) {
  const chars = value.split('')

  // place index per char position: 0 = rightmost digit, increasing leftward
  const place: Record<number, number> = {}
  let seen = 0
  for (let i = chars.length - 1; i >= 0; i--) {
    if (chars[i] >= '0' && chars[i] <= '9') { place[i] = seen; seen++ }
  }
  const maxPlace = Math.max(0, seen - 1)
  const g = glyphStyle(gradient)

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: `${CELL_EM}em`, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
      {chars.map((ch, i) => {
        if (ch >= '0' && ch <= '9') {
          const p = place[i]
          return <Drum key={i} digit={Number(ch)} duration={900 + p * 80} delay={(maxPlace - p) * 15} gradient={gradient} />
        }
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', height: `${CELL_EM}em`, ...g }}>{ch}</span>
        )
      })}
    </span>
  )
}
