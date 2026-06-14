import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: 'images.pokemontcg.io' },
      { hostname: 'ydbcfvernfothrukmyty.supabase.co' },
      { hostname: 'images.scrydex.com' },
    ],
  },
}

export default nextConfig
