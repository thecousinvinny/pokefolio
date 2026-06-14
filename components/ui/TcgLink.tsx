'use client'

interface TcgLinkProps {
  url: string
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

// Opens the URL in a new window/tab without navigating the PWA away.
// window.open(_blank) on iOS PWA launches Safari as an overlay while the
// PWA continues running in the background — state is fully preserved.
export function TcgLink({ url, children, style, className }: TcgLinkProps) {
  return (
    <a
      href={url}
      onClick={e => { e.preventDefault(); window.open(url, '_blank', 'noopener,noreferrer') }}
      style={style}
      className={className}
    >
      {children}
    </a>
  )
}
