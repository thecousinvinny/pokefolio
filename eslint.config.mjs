import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({ baseDirectory: import.meta.dirname })

const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'scripts/**', 'VAULT/**', 'FOLIO/**', 'OLD/**'],
  },
  {
    rules: {
      // Cosmetic — quotes/apostrophes in JSX copy render fine.
      'react/no-unescaped-entities': 'off',
    },
  },
]

export default config
