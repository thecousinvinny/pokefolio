'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: DashIcon },
  { href: '/browse',    label: 'Browse',    icon: BrowseIcon },
  { href: '/wishlist',  label: 'Wishlist',  icon: WishlistIcon },
  { href: '/portfolio', label: 'Portfolio', icon: PortfolioIcon },
  { href: '/sold',      label: 'Sold',      icon: SoldIcon },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <main style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'calc(80px + env(safe-area-inset-bottom))',
      }}>
        {children}
      </main>
      <FloatingTabBar />
    </div>
  )
}

function FloatingTabBar() {
  const pathname = usePathname()
  const activeIdx = NAV.findIndex(n => pathname === n.href || pathname.startsWith(n.href + '/'))
  const iconRefs = useRef<(HTMLDivElement | null)[]>([])
  const navRef = useRef<HTMLElement>(null)
  const [pill, setPill] = useState<{ left: number; top: number; w: number; h: number } | null>(null)
  const isFirst = useRef(true)

  useEffect(() => {
    const icon = iconRefs.current[activeIdx]
    const nav = navRef.current
    if (!icon || !nav) return
    const nr = nav.getBoundingClientRect()
    const ir = icon.getBoundingClientRect()
    setPill({ left: ir.left - nr.left, top: ir.top - nr.top, w: ir.width, h: ir.height })
    isFirst.current = false
  }, [activeIdx, pathname])

  return (
    <nav
      ref={navRef}
      aria-label="Main navigation"
      style={{
        position: 'fixed',
        bottom: 'calc(4px + env(safe-area-inset-bottom))',
        left: 14,
        right: 14,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        height: 68,
        borderRadius: 34,
        background: 'rgba(20, 22, 38, 0.28)',
        backdropFilter: 'blur(40px) saturate(200%) brightness(0.88)',
        WebkitBackdropFilter: 'blur(40px) saturate(200%) brightness(0.88)',
        border: '1px solid rgba(255, 255, 255, 0.13)',
        boxShadow: [
          'inset 0 1px 0 rgba(255, 255, 255, 0.10)',
          'inset 0 -1px 0 rgba(0, 0, 0, 0.18)',
          '0 24px 64px rgba(0, 0, 0, 0.65)',
          '0 4px 20px rgba(0, 0, 0, 0.38)',
        ].join(', '),
        padding: '0 6px',
      }}>

      {/* Sliding gold pill — moves between active tabs with spring bounce */}
      {pill && (
        <div style={{
          position: 'absolute',
          left: pill.left,
          top: pill.top,
          width: pill.w,
          height: pill.h,
          borderRadius: 999,
          background: 'rgba(255, 255, 255, 0.13)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.26)',
          boxShadow: [
            'inset 0 1.5px 0 rgba(255, 255, 255, 0.52)',
            'inset 0 -1px 0 rgba(0, 0, 0, 0.10)',
          ].join(', '),
          pointerEvents: 'none',
          zIndex: 0,
          transition: 'left 0.38s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.38s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.38s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }} />
      )}

      {NAV.map(({ href, label, icon: Icon }, i) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            prefetch
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              textDecoration: 'none',
              color: active ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.40)',
              transition: 'color 0.20s ease',
              WebkitTapHighlightColor: 'transparent',
              position: 'relative',
              zIndex: 1,
            }}>
            <div
              ref={el => { iconRefs.current[i] = el }}
              style={{
                padding: '7px 20px',
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon active={active} />
            </div>
            <span style={{
              fontSize: 10,
              fontWeight: active ? 700 : 500,
              letterSpacing: '0.01em',
              lineHeight: 1,
              marginTop: -1,
              transition: 'font-weight 0.15s ease',
            }}>
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

interface IconProps { active?: boolean }

const SIZE = 24
const ACTIVE_W = 2.2
const INACTIVE_W = 1.7

function DashIcon({ active }: IconProps) {
  return (
    <svg width={SIZE} height={SIZE} fill="none" viewBox="0 0 24 24"
      strokeWidth={active ? ACTIVE_W : INACTIVE_W} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  )
}

function BrowseIcon({ active }: IconProps) {
  return (
    <svg width={SIZE} height={SIZE} fill="none" viewBox="0 0 24 24"
      strokeWidth={active ? ACTIVE_W : INACTIVE_W} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}

function PortfolioIcon({ active }: IconProps) {
  return (
    <svg width={SIZE} height={SIZE} fill="none" viewBox="0 0 24 24"
      strokeWidth={active ? ACTIVE_W : INACTIVE_W} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878M18 6.878A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6a2.25 2.25 0 012.25-2.25h13.5z" />
    </svg>
  )
}

function WishlistIcon({ active }: IconProps) {
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 24 24"
      strokeWidth={active ? ACTIVE_W : INACTIVE_W} stroke="currentColor"
      fill={active ? 'currentColor' : 'none'}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  )
}

function SoldIcon({ active }: IconProps) {
  return (
    <svg width={SIZE} height={SIZE} fill="none" viewBox="0 0 24 24"
      strokeWidth={active ? ACTIVE_W : INACTIVE_W} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
