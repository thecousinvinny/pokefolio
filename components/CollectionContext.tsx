'use client'
import {
  createContext, useContext, useEffect, useRef, useState, useCallback, useMemo,
  type ReactNode
} from 'react'
import { createClient } from '@/lib/supabase/client'
import type { PokemonCard, SaleRecord } from '@/types'

interface SellPayload {
  sold_price: number
  fees: number
  shipping: number
  sale_type?: 'sale' | 'gift'
}

interface CollectionContextType {
  cards: PokemonCard[]
  sales: SaleRecord[]
  loading: boolean
  refresh: () => void
  addCard: (card: Omit<PokemonCard, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => void
  updateCard: (id: string, updates: Partial<PokemonCard>) => void
  removeCard: (id: string) => void
  sellCard: (card: PokemonCard, payload: SellPayload) => void
  giftCard: (card: PokemonCard) => void
  setFavorite: (id: string) => void
  toggleAlert: (id: string) => void
}

const CollectionContext = createContext<CollectionContextType | null>(null)

export function CollectionProvider({ children }: { children: ReactNode }) {
  const [cards, setCards] = useState<PokemonCard[]>([])
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  const supabase = useMemo(() => createClient(), [])
  const cardsRef = useRef<PokemonCard[]>([])
  useEffect(() => { cardsRef.current = cards }, [cards])

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)

    const [cardsRes, salesRes] = await Promise.all([
      supabase.from('pokemon_cards').select('*').order('created_at', { ascending: false }),
      supabase.from('pokemon_sales').select('*').order('date_sold', { ascending: false }),
    ])

    setCards((cardsRes.data ?? []) as PokemonCard[])
    setSales((salesRes.data ?? []) as SaleRecord[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const addCard = useCallback((cardData: Omit<PokemonCard, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!userId) return
    const now = new Date().toISOString()
    const tempId = crypto.randomUUID()
    const tempCard: PokemonCard = { ...cardData, id: tempId, user_id: userId, created_at: now, updated_at: now }
    setCards(prev => [tempCard, ...prev])

    supabase
      .from('pokemon_cards')
      .insert({ ...cardData, user_id: userId })
      .select()
      .single()
      .then(({ data }) => {
        if (data) setCards(prev => prev.map(c => c.id === tempId ? data as PokemonCard : c))
      })
  }, [supabase, userId])

  const updateCard = useCallback((id: string, updates: Partial<PokemonCard>) => {
    const now = new Date().toISOString()
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...updates, updated_at: now } : c))
    supabase.from('pokemon_cards').update({ ...updates, updated_at: now }).eq('id', id)
  }, [supabase])

  const removeCard = useCallback((id: string) => {
    setCards(prev => prev.filter(c => c.id !== id))
    supabase.from('pokemon_cards').delete().eq('id', id)
  }, [supabase])

  const sellCard = useCallback((card: PokemonCard, payload: SellPayload) => {
    if (!userId) return
    const now = new Date().toISOString()
    const tempId = crypto.randomUUID()
    const tempSale: SaleRecord = {
      id: tempId,
      user_id: userId,
      tcg_id: card.tcg_id,
      card_name: card.name,
      set_name: card.set_name,
      image_sm: card.image_sm,
      card_snapshot: card as unknown as Record<string, unknown>,
      sale_type: payload.sale_type ?? 'sale',
      date_sold: now,
      sold_price: payload.sold_price,
      fees: payload.fees,
      shipping: payload.shipping,
      cost_basis: card.price_paid ?? 0,
      net_profit: payload.sold_price - payload.fees - payload.shipping - (card.price_paid ?? 0),
      created_at: now,
    }

    setCards(prev => prev.filter(c => c.id !== card.id))
    setSales(prev => [tempSale, ...prev])

    Promise.all([
      supabase.from('pokemon_cards').delete().eq('id', card.id),
      supabase
        .from('pokemon_sales')
        .insert({
          user_id: userId,
          tcg_id: card.tcg_id,
          card_name: card.name,
          set_name: card.set_name,
          image_sm: card.image_sm,
          card_snapshot: card as unknown as Record<string, unknown>,
          sale_type: payload.sale_type ?? 'sale',
          date_sold: now,
          sold_price: payload.sold_price,
          fees: payload.fees,
          shipping: payload.shipping,
          cost_basis: card.price_paid ?? 0,
        })
        .select()
        .single(),
    ]).then(([, { data }]) => {
      if (data) setSales(prev => prev.map(s => s.id === tempId ? data as SaleRecord : s))
    })
  }, [supabase, userId])

  const giftCard = useCallback((card: PokemonCard) => {
    sellCard(card, { sold_price: 0, fees: 0, shipping: 0, sale_type: 'gift' })
  }, [sellCard])

  const setFavorite = useCallback((id: string) => {
    const prev = cardsRef.current
    const isFav = !!prev.find(c => c.id === id)?.is_favorite
    setCards(prev => prev.map(c => ({ ...c, is_favorite: c.id === id ? !isFav : false })))
    supabase.from('pokemon_cards').update({ is_favorite: !isFav }).eq('id', id)
    prev.filter(c => c.id !== id && c.is_favorite).forEach(c =>
      supabase.from('pokemon_cards').update({ is_favorite: false }).eq('id', c.id)
    )
  }, [supabase])

  const toggleAlert = useCallback((id: string) => {
    const card = cardsRef.current.find(c => c.id === id)
    if (!card) return
    const newVal = !card.alerts_enabled
    setCards(prev => prev.map(c => c.id === id ? { ...c, alerts_enabled: newVal } : c))
    supabase.from('pokemon_cards').update({ alerts_enabled: newVal }).eq('id', id)
  }, [supabase])

  const refresh = useCallback(() => { load() }, [load])

  return (
    <CollectionContext.Provider value={{
      cards, sales, loading, refresh,
      addCard, updateCard, removeCard, sellCard, giftCard, setFavorite, toggleAlert,
    }}>
      {children}
    </CollectionContext.Provider>
  )
}

export function useCollection() {
  const ctx = useContext(CollectionContext)
  if (!ctx) throw new Error('useCollection must be used within CollectionProvider')
  return ctx
}
