import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    // Card art comes from already-optimized CDNs (pokemontcg.io / scrydex).
    // Skip Vercel's Image Optimization so a 20k-card catalog + infinite scroll
    // doesn't burn billable transformations re-optimizing optimized PNGs.
    unoptimized: true,
    remotePatterns: [
      { hostname: 'images.pokemontcg.io' },
      { hostname: 'ydbcfvernfothrukmyty.supabase.co' },
      { hostname: 'images.scrydex.com' },
    ],
  },
}

export default nextConfig
