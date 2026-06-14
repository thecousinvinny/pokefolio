import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0D0F1A',
        elevated: '#171923',
        surface: '#1E2033',
        's2': '#252840',
        gold: '#FFC845',
        amber: '#FF9E2E',
        crimson: '#F24560',
        emerald: '#45DB8D',
        sky: '#5DA9FF',
        violet: '#9C72FA',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      borderColor: {
        DEFAULT: 'rgba(255,255,255,0.08)',
      },
    },
  },
  plugins: [],
}

export default config
