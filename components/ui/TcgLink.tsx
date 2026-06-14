'use client'
import { useCallback } from 'react'

function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false
  return (
    ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true) ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

interface TcgLinkProps {
  url: string
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

// On iOS PWA, target="_blank" breaks out of the app and opens Safari.
// This component keeps navigation in-app when running as a home-screen PWA.
export function TcgLink({ url, children, style, className }: TcgLinkProps) {
  const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isStandalonePWA()) {
      e.preventDefault()
      window.location.href = url
    }
  }, [url])

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      style={style}
      className={className}
    >
      {children}
    </a>
  )
}
