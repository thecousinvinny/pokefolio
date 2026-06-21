'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  maxWidth?: number
}

const CLOSE_THRESHOLD = 110     // px pulled down to dismiss
const FLICK_VELOCITY = 0.5      // px/ms downward flick that dismisses regardless of distance
const SNAP_BACK = 'transform 0.34s cubic-bezier(0.34, 1.56, 0.64, 1)'

export function Modal({ open, onClose, title, children, maxWidth = 480 }: ModalProps) {
  const [dragY, setDragY] = useState(0)
  const [snapping, setSnapping] = useState(false)
  const [closing, setClosing] = useState(false)   // flinging physically off-screen
  const [closeArmed, setCloseArmed] = useState(false)

  const startYRef = useRef(0)
  const dragYRef = useRef(0)
  const draggingRef = useRef(false)
  const pointerActive = useRef(false)
  const lastYRef = useRef(0)
  const lastTRef = useRef(0)
  const velRef = useRef(0)

  // Keep onClose in a ref so the timer effect doesn't reset on a fresh onClose each render.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Animate-out state: visible = portal rendered, animOut = closing anim playing
  const [visible, setVisible] = useState(open)
  const [animOut, setAnimOut] = useState(false)

  useEffect(() => {
    if (open) {
      setVisible(true)
      setAnimOut(false)
      setDragY(0)
      setSnapping(false)
      setClosing(false)
      setCloseArmed(false)
    } else if (visible) {
      setAnimOut(true)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleAnimEnd() {
    if (animOut) setVisible(false)
  }

  // Keyboard + body scroll lock
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [open])

  // Dismiss fling: arm the off-screen transform next frame (so it animates from the
  // drag position), then unmount on a timer — never relying on transitionend.
  useEffect(() => {
    if (!closing) return
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setCloseArmed(true)))
    const timer = setTimeout(() => { setVisible(false); onCloseRef.current() }, 360)
    return () => { cancelAnimationFrame(raf); clearTimeout(timer) }
  }, [closing])

  // ── Drag-to-dismiss via Pointer Events on the header (touch + mouse). Pointer
  // capture keeps move/up coming to the header even as the finger leaves it;
  // touch-action:none on the header means the gesture can only drag, never scroll. ──
  function onHeaderPointerDown(e: React.PointerEvent) {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    pointerActive.current = true
    startYRef.current = e.clientY
    lastYRef.current = e.clientY
    lastTRef.current = performance.now()
    velRef.current = 0
    draggingRef.current = false
    dragYRef.current = 0
    setSnapping(false)
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch {}
  }

  function onHeaderPointerMove(e: React.PointerEvent) {
    if (!pointerActive.current) return
    const delta = e.clientY - startYRef.current
    if (delta > 0) {
      draggingRef.current = true
      const now = performance.now()
      velRef.current = (e.clientY - lastYRef.current) / Math.max(1, now - lastTRef.current)
      lastYRef.current = e.clientY
      lastTRef.current = now
      dragYRef.current = delta
      setDragY(delta)
    } else if (draggingRef.current) {
      dragYRef.current = 0
      setDragY(0)
    }
  }

  function onHeaderPointerUp(e: React.PointerEvent) {
    if (!pointerActive.current) return
    pointerActive.current = false
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch {}
    const dismiss = draggingRef.current && (dragYRef.current > CLOSE_THRESHOLD || velRef.current > FLICK_VELOCITY)
    if (dismiss) setClosing(true)
    else if (draggingRef.current) { setSnapping(true); setDragY(0) }
    draggingRef.current = false
    dragYRef.current = 0
  }

  if (!visible) return null

  const dragging = dragY > 0 && !snapping && !closing
  const backdropAlpha = closing
    ? '0.00'
    : dragY > 0
      ? Math.max(0.15, 0.7 * (1 - dragY / 320)).toFixed(2)
      : '0.70'

  let transform: string | undefined
  let transition: string | undefined
  if (closing) {
    // ease-OUT continues the fling momentum and decelerates off-screen (no mid-way hang)
    transform = closeArmed ? 'translateY(100vh)' : `translateY(${dragY}px)`
    transition = 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)'
  } else if (dragging) { transform = `translateY(${dragY}px)`; transition = 'transform 0s' }
  else if (snapping) { transform = 'translateY(0)'; transition = SNAP_BACK }

  function onContentTransitionEnd(e: React.TransitionEvent) {
    if (e.target !== e.currentTarget || e.propertyName !== 'transform') return
    if (closing) { setVisible(false); onCloseRef.current() }   // unmount exactly as the fling lands
    else if (snapping) setSnapping(false)
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-[200] flex items-end sm:items-center justify-center px-4 modal-backdrop ${animOut ? 'animate-backdrop-out' : 'animate-backdrop-in'}`}
      style={{
        background: `rgba(0,0,0,${backdropAlpha})`,
        transition: closing ? 'background 0.34s linear' : undefined,
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div
        className={`w-full rounded-2xl ${animOut ? 'animate-slide-down' : closing ? '' : 'animate-slide-up'}`}
        onAnimationEnd={handleAnimEnd}
        onTransitionEnd={onContentTransitionEnd}
        style={{
          maxWidth,
          background: 'var(--elevated)',
          border: '1px solid var(--border2)',
          maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 32px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',          // outer never scrolls — it only transforms
          transform,
          transition,
          willChange: 'transform',
        }}>

        {/* Drag header — pointer-drag to dismiss; lives outside the scroller so it
            can only drag. Grab the bar (or the title row when present). */}
        <div
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
          onPointerCancel={onHeaderPointerUp}
          style={{ flexShrink: 0, touchAction: 'none', cursor: 'grab', userSelect: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0 10px' }}>
            <div style={{
              width: 44, height: 5, borderRadius: 3,
              background: `rgba(255,255,255,${dragY > 0 ? 0.55 : 0.28})`,
              transition: 'background 0.15s',
            }} />
          </div>

          {title && (
            <div className="flex items-center justify-between px-5 pb-4"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="font-bold text-base">{title}</h2>
              <button onClick={onClose} onPointerDown={e => e.stopPropagation()}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ color: 'var(--text3)' }}>
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div className="p-5" style={{ overflowY: 'auto', overscrollBehavior: 'contain', flex: '1 1 auto' }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
