'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RootPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')
    if (code) {
      const supabase = createClient()
      supabase.auth.exchangeCodeForSession(code).then(() => {
        router.replace('/dashboard')
      })
    } else {
      router.replace('/dashboard')
    }
  }, [])

  return null
}
