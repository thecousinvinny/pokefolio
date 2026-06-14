import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: 'images.pokemontcg.io' },
      { hostname: 'ydbcfvernfothrukmyty.supabase.co' },
    ],
  },
}

export default nextConfig
