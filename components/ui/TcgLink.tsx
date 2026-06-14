'use client'
import { useWebSheet } from './WebSheet'

interface TcgLinkProps {
  url: string
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

// Opens TCGPlayer in an in-app sheet instead of navigating away (which destroys Browse state).
export function TcgLink({ url, children, style, className }: TcgLinkProps) {
  const { open } = useWebSheet()
  return (
    <a
      href={url}
      onClick={e => { e.preventDefault(); open(url) }}
      style={style}
      className={className}
    >
      {children}
    </a>
  )
}
