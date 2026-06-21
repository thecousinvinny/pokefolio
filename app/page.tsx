'use client'
import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function RootRedirect() {
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
  }, [router, searchParams])

  return null
}

export default function RootPage() {
  return (
    <Suspense>
      <RootRedirect />
    </Suspense>
  )
}
