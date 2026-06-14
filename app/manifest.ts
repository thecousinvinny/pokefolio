import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CATCHM',
    short_name: 'CATCHM',
    description: 'Pokémon TCG Portfolio Tracker',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0D0F1A',
    theme_color: '#FFC845',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
