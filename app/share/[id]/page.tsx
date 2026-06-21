import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ShareView } from './ShareView'

interface Props { params: Promise<{ id: string }> }

async function getShare(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('public_shares')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  return data
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const share = await getShare(id)
  if (!share) return { title: 'CATCHM' }
  const name = share.display_name || 'A Collector'
  const count = (share.cards_data?.length ?? 0) + (share.wishlist_data?.length ?? 0)
  const desc = `Check out ${name}'s Pokémon TCG collection — ${count} card${count !== 1 ? 's' : ''}`
  return {
    title: `${name}'s Collection · CATCHM`,
    description: desc,
    openGraph: { title: `${name}'s Collection · CATCHM`, description: desc },
  }
}

export default async function SharePage({ params }: Props) {
  const { id } = await params
  const share = await getShare(id)
  if (!share) return <ShareUnavailable />
  return <ShareView share={share} />
}

// Shown when the share row doesn't exist OR has expired (RLS hides expired rows).
function ShareUnavailable() {
  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: '0 24px', gap: 14,
    }}>
      <div style={{ fontSize: 44 }}>🔗</div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>This link isn’t available</h1>
      <p style={{ fontSize: 14, color: 'var(--text3)', maxWidth: 320, lineHeight: 1.6, margin: 0 }}>
        This share link has expired or no longer exists. Ask the collector for a fresh link.
      </p>
      <Link href="/" style={{
        marginTop: 8, padding: '11px 22px', borderRadius: 999, fontWeight: 700, fontSize: 14,
        background: 'var(--btn-info)', color: '#fff', textDecoration: 'none',
      }}>Open CATCHM</Link>
    </div>
  )
}
