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
  const ref = useRef<HTMLDivElement>(null)        // outer: transform target + touch target (not scrollable)
  const scrollRef = useRef<HTMLDivElement>(null)  // inner: the scrollable content
  const handleRef = useRef<HTMLDivElement>(null)  // header: handle + title (outside the scroller)
  const [dragY, setDragY] = useState(0)
  const [snapping, setSnapping] = useState(false)
  const [closing, setClosing] = useState(false)   // flinging physically off-screen
  const [closeArmed, setCloseArmed] = useState(false)

  const startYRef = useRef(0)
  const dragYRef = useRef(0)
  const draggingRef = useRef(false)
  const fromHandleRef = useRef(false)
  const lastYRef = useRef(0)
  const lastTRef = useRef(0)
  const velRef = useRef(0)

  // Keep onClose in a ref so gesture/timer effects don't re-run (and reset) when
  // the parent passes a fresh onClose each render.
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

  // Drive the dismiss fling deterministically: arm the off-screen transform on the
  // next frame (so the transition reliably animates from the drag position), then
  // unmount on a timer — never relying on transitionend, which can be skipped.
  useEffect(() => {
    if (!closing) return
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setCloseArmed(true)))
    const timer = setTimeout(() => { setVisible(false); onCloseRef.current() }, 360)
    return () => { cancelAnimationFrame(raf); clearTimeout(timer) }
  }, [closing])

  // Swipe / pull-down to dismiss. Drags when grabbing the handle (always) or when
  // the content is scrolled to the top. Dismisses past a distance threshold OR on a
  // fast downward flick; otherwise springs back into place.
  useEffect(() => {
    const el = ref.current
    if (!el || !open) return

    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0]
      startYRef.current = t.clientY
      lastYRef.current = t.clientY
      lastTRef.current = performance.now()
      velRef.current = 0
      draggingRef.current = false
      dragYRef.current = 0
      fromHandleRef.current = !!handleRef.current && handleRef.current.contains(e.target as Node)
      setSnapping(false)
    }

    function onTouchMove(e: TouchEvent) {
      const t = e.touches[0]
      const delta = t.clientY - startYRef.current
      const canDrag = fromHandleRef.current || (scrollRef.current?.scrollTop ?? 0) <= 0
      if (delta > 0 && canDrag) {
        e.preventDefault()
        draggingRef.current = true
        const now = performance.now()
        velRef.current = (t.clientY - lastYRef.current) / Math.max(1, now - lastTRef.current)
        lastYRef.current = t.clientY
        lastTRef.current = now
        dragYRef.current = delta
        setDragY(delta)
      }
    }

    function onTouchEnd() {
      const dismiss = draggingRef.current && (dragYRef.current > CLOSE_THRESHOLD || velRef.current > FLICK_VELOCITY)
      if (dismiss) {
        setClosing(true)    // fling the rest of the way down, then unmount
      } else if (draggingRef.current) {
        setSnapping(true)   // spring back into place
        setDragY(0)
      }
      draggingRef.current = false
      dragYRef.current = 0
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [open])

  if (!visible) return null

  const dragging = dragY > 0 && !snapping && !closing
  const backdropAlpha = closing
    ? '0.00'
    : dragY > 0
      ? Math.max(0.15, 0.7 * (1 - dragY / 320)).toFixed(2)
      : '0.70'

  // closing flings from the current drag position the rest of the way off-screen.
  // First render keeps the drag position (transition already present); the armed
  // frame moves it to 100vh so the browser animates between them.
  let transform: string | undefined
  let transition: string | undefined
  if (closing) {
    // ease-OUT: continues the fling momentum and decelerates off-screen (no mid-way hang)
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
      className={`fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 modal-backdrop ${animOut ? 'animate-backdrop-out' : 'animate-backdrop-in'}`}
      style={{ background: `rgba(0,0,0,${backdropAlpha})`, transition: closing ? 'background 0.34s linear' : undefined }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div
        ref={ref}
        className={`w-full rounded-2xl ${animOut ? 'animate-slide-down' : closing ? '' : 'animate-slide-up'}`}
        onAnimationEnd={handleAnimEnd}
        onTransitionEnd={onContentTransitionEnd}
        style={{
          maxWidth,
          background: 'var(--elevated)',
          border: '1px solid var(--border2)',
          maxHeight: 'calc(100dvh - 2rem)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',          // outer never scrolls — it only transforms
          transform,
          transition,
          willChange: 'transform',
        }}>

        {/* Drag header — lives OUTSIDE the scroller, so grabbing it can only drag
            the sheet (never scroll). Grab the handle or the title bar. */}
        <div ref={handleRef} style={{
          flexShrink: 0,
          touchAction: 'none', cursor: 'grab', userSelect: 'none',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
            <div style={{
              width: 40, height: 5, borderRadius: 3,
              background: `rgba(255,255,255,${dragY > 0 ? 0.5 : 0.25})`,
              transition: 'background 0.15s',
            }} />
          </div>

          {title && (
            <div className="flex items-center justify-between px-5 pb-4"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="font-bold text-base">{title}</h2>
              <button onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: 'var(--text3)' }}>
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Scrollable content — drag-to-dismiss only kicks in when this is at the top */}
        <div ref={scrollRef} className="p-5" style={{ overflowY: 'auto', overscrollBehavior: 'contain', flex: '1 1 auto' }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
