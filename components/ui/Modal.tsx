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

const CLOSE_THRESHOLD = 88

export function Modal({ open, onClose, title, children, maxWidth = 480 }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [dragY, setDragY] = useState(0)
  const startYRef = useRef(0)
  const dragYRef = useRef(0)
  const draggingRef = useRef(false)

  // Animate-out state: visible = whether the portal is rendered, animOut = whether closing anim is playing
  const [visible, setVisible] = useState(open)
  const [animOut, setAnimOut] = useState(false)

  useEffect(() => {
    if (open) {
      setVisible(true)
      setAnimOut(false)
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
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  // Non-passive touch listeners for swipe-to-close
  useEffect(() => {
    const el = ref.current
    if (!el || !open) return

    function onTouchStart(e: TouchEvent) {
      startYRef.current = e.touches[0].clientY
      draggingRef.current = false
      dragYRef.current = 0
    }

    function onTouchMove(e: TouchEvent) {
      const delta = e.touches[0].clientY - startYRef.current
      if (delta > 0 && (el?.scrollTop ?? 0) <= 0) {
        e.preventDefault()
        draggingRef.current = true
        dragYRef.current = delta
        setDragY(delta)
      }
    }

    function onTouchEnd() {
      if (draggingRef.current && dragYRef.current > CLOSE_THRESHOLD) {
        onClose()
      }
      draggingRef.current = false
      dragYRef.current = 0
      setDragY(0)
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [open, onClose])

  if (!visible) return null

  const isDragging = dragY > 0
  const backdropAlpha = isDragging
    ? Math.max(0.15, 0.7 * (1 - dragY / 320)).toFixed(2)
    : '0.70'

  return createPortal(
    <div
      className={`fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 modal-backdrop ${animOut ? 'animate-backdrop-out' : 'animate-backdrop-in'}`}
      style={{
        background: `rgba(0,0,0,${backdropAlpha})`,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div
        ref={ref}
        className={`w-full rounded-2xl ${animOut ? 'animate-slide-down' : 'animate-slide-up'}`}
        onAnimationEnd={handleAnimEnd}
        style={{
          maxWidth,
          background: 'var(--elevated)',
          border: '1px solid var(--border2)',
          maxHeight: 'calc(100dvh - 2rem)',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          transform: isDragging ? `translateY(${dragY}px)` : undefined,
          transition: isDragging ? 'none' : undefined,
          willChange: 'transform',
        }}>

        {/* Drag handle */}
        <div style={{
          display: 'flex', justifyContent: 'center',
          padding: '10px 0 0',
          userSelect: 'none',
        }}>
          <div style={{
            width: 36, height: 4, borderRadius: 2,
            background: `rgba(255,255,255,${isDragging ? 0.4 : 0.2})`,
            transition: 'background 0.15s',
          }} />
        </div>

        {title && (
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="font-bold text-base">{title}</h2>
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: 'var(--text3)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}>
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  )
}
