import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

export const metadata: Metadata = {
  title: 'CATCHM — Pokémon TCG Portfolio Tracker',
  description: 'Track your Pokémon card collection, monitor prices, and manage your trades.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CATCHM',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0D0F1A',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body suppressHydrationWarning>
        {children}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            try {
              if (!sessionStorage.getItem('__swkill')) {
                navigator.serviceWorker.getRegistrations().then(function(regs) {
                  if (regs.length > 0) {
                    sessionStorage.setItem('__swkill', '1')
                    Promise.all(regs.map(function(r) { return r.unregister() })).then(function() {
                      window.location.reload()
                    })
                  }
                })
              }
            } catch(e) {}
          }
        `}} />
      </body>
    </html>
  )
}
