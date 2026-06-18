import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
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
  if (!share) notFound()
  return <ShareView share={share} />
}
