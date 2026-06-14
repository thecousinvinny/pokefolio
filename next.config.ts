import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { hostname: 'images.pokemontcg.io' },
      { hostname: 'ydbcfvernfothrukmyty.supabase.co' },
    ],
  },
}

export default nextConfig
