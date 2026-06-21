'use client'
import {
  createContext, useContext, useEffect, useRef, useState, useCallback, useMemo,
  type ReactNode
} from 'react'
import { createClient } from '@/lib/supabase/client'
import type { PokemonCard, SaleRecord } from '@/types'

// localStorage fallback keys — used only when Supabase is unavailable
const LS_CARDS = 'catchm_cards_v1'
const LS_SALES = 'catchm_sales_v1'

function lsRead<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') as T[] } catch { return [] }
}
function lsWrite<T>(key: string, data: T[]): void {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch { /* quota */ }
}

interface SellPayload {
  sold_price: number
  fees: number
  shipping: number
  sale_type?: 'sale' | 'gift' | 'trade'
}

interface CollectionContextType {
  cards: PokemonCard[]
  sales: SaleRecord[]
  loading: boolean
  addCard: (card: Omit<PokemonCard, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => void
  updateCard: (id: string, updates: Partial<PokemonCard>) => void
  removeCard: (id: string) => void
  sellCard: (card: PokemonCard, payload: SellPayload) => void
  setFavorite: (id: string) => void
  setShowcase: (id: string) => void
}

const CollectionContext = createContext<CollectionContextType | null>(null)

export function CollectionProvider({ children }: { children: ReactNode }) {
  const [cards, setCards] = useState<PokemonCard[]>([])
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [useLocalStorage, setUseLocalStorage] = useState(false)

  const supabase = useMemo(() => createClient(), [])
  const cardsRef = useRef<PokemonCard[]>([])
  useEffect(() => { cardsRef.current = cards }, [cards])

  // localStorage as write-through cache — always stays fresh, skips initial empty state
  const cardsHydrated = useRef(false)
  useEffect(() => {
    if (!cardsHydrated.current) { cardsHydrated.current = true; return }
    lsWrite(LS_CARDS, cards)
  }, [cards])

  const salesHydrated = useRef(false)
  useEffect(() => {
    if (!salesHydrated.current) { salesHydrated.current = true; return }
    lsWrite(LS_SALES, sales)
  }, [sales])

  const load = useCallback(async () => {
    // Pre-hydrate from cache — returning users see their collection instantly, no skeleton
    const cachedCards = lsRead<PokemonCard>(LS_CARDS)
    const cachedSales = lsRead<SaleRecord>(LS_SALES)
    const hasCached = cachedCards.length > 0 || cachedSales.length > 0
    if (hasCached) {
      setCards(cachedCards)
      setSales(cachedSales)
      setLoading(false)
    } else {
      setLoading(true)
    }

    try {
      let { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        const { data, error } = await supabase.auth.signInAnonymously()
        if (!error) user = data.user
      }
      if (user) {
        setUserId(user.id)
        const [cardsRes, salesRes] = await Promise.all([
          supabase.from('pokemon_cards').select('*').order('created_at', { ascending: false }),
          supabase.from('pokemon_sales').select('*').order('date_sold', { ascending: false }),
        ])
        if (!cardsRes.error) {
          setCards((cardsRes.data ?? []) as PokemonCard[])
          setSales((salesRes.data ?? []) as SaleRecord[])
          setLoading(false)
          return
        }
      }
    } catch { /* network error — keep showing cached data */ }

    // Supabase unavailable
    setUseLocalStorage(true)
    if (!hasCached) {
      setCards(lsRead<PokemonCard>(LS_CARDS))
      setSales(lsRead<SaleRecord>(LS_SALES))
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { load() }, [load])

  // ── Mutations ──────────────────────────────────────────────────────────────

  const addCard = useCallback((cardData: Omit<PokemonCard, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    const now = new Date().toISOString()
    const tempId = crypto.randomUUID()

    if (useLocalStorage || !userId) {
      const newCard: PokemonCard = { ...cardData, id: tempId, user_id: 'local', created_at: now, updated_at: now }
      setCards(prev => [newCard, ...prev])
      return
    }

    const tempCard: PokemonCard = { ...cardData, id: tempId, user_id: userId, created_at: now, updated_at: now }
    setCards(prev => [tempCard, ...prev])

    supabase
      .from('pokemon_cards')
      .insert({ ...cardData, user_id: userId })
      .select()
      .single()
      .then(({ data, error }) => {
        if (data && !error) {
          setCards(prev => prev.map(c => c.id === tempId ? data as PokemonCard : c))
        } else {
          // Insert failed — remove optimistic card
          setCards(prev => prev.filter(c => c.id !== tempId))
          console.error('[CATCHM] addCard failed:', error?.message)
        }
      })
  }, [supabase, userId, useLocalStorage])

  const updateCard = useCallback((id: string, updates: Partial<PokemonCard>) => {
    const now = new Date().toISOString()
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...updates, updated_at: now } : c))
    if (!useLocalStorage && userId) {
      supabase.from('pokemon_cards').update({ ...updates, updated_at: now }).eq('id', id)
        .then(({ error }) => { if (error) console.error('[CATCHM] updateCard:', error.message) })
    }
  }, [supabase, userId, useLocalStorage])

  // Backfill missing prices. Collection prices are captured at add-time and never
  // refresh, so cards added without one (old/promo cards pokemontcg.io priced later,
  // or that needed tcgcsv) stay blank. On load, re-fetch the current price for any
  // card missing one and patch it in. Each tcg_id is tried once per session; batches
  // of 60 paginate as updates land.
  const priceRefreshTried = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (loading) return
    const ids = [...new Set(
      cards
        .filter(c => c.tcg_id && (c.market_price == null || c.market_price === 0) && !priceRefreshTried.current.has(c.tcg_id))
        .map(c => c.tcg_id),
    )].slice(0, 40)
    if (ids.length === 0) return
    ids.forEach(id => priceRefreshTried.current.add(id))

    ;(async () => {
      try {
        const res = await fetch('/api/prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        })
        if (!res.ok) return
        const { prices } = await res.json() as { prices: Record<string, number> }
        const now = new Date().toISOString()
        cards.forEach(c => {
          const m = prices[c.tcg_id]
          if (m != null && m !== c.market_price) updateCard(c.id, { market_price: m, price_updated_at: now })
        })
      } catch { /* offline / transient — retried next session */ }
    })()
  }, [cards, loading, updateCard])

  const removeCard = useCallback((id: string) => {
    setCards(prev => prev.filter(c => c.id !== id))
    if (!useLocalStorage && userId) {
      supabase.from('pokemon_cards').delete().eq('id', id)
        .then(({ error }) => {
          if (error) {
            console.error('[CATCHM] removeCard failed:', error.message)
            // Roll back — re-fetch
            load()
          }
        })
    }
  }, [supabase, userId, useLocalStorage, load])

  const sellCard = useCallback((card: PokemonCard, payload: SellPayload) => {
    const now = new Date().toISOString()
    const netProfit = payload.sold_price - payload.fees - payload.shipping - (card.price_paid ?? 0)
    const tempId = crypto.randomUUID()
    const tempSale: SaleRecord = {
      id: tempId,
      user_id: userId ?? 'local',
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
      net_profit: netProfit,
      created_at: now,
    }

    setCards(prev => prev.filter(c => c.id !== card.id))
    setSales(prev => [tempSale, ...prev])

    if (useLocalStorage || !userId) return

    Promise.all([
      supabase.from('pokemon_cards').delete().eq('id', card.id),
      supabase.from('pokemon_sales').insert({
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
        // net_profit is a GENERATED column — do NOT insert it
      }).select().single(),
    ]).then(([, { data, error }]) => {
      if (data && !error) {
        setSales(prev => prev.map(s => s.id === tempId ? data as SaleRecord : s))
      }
    })
  }, [supabase, userId, useLocalStorage])

  const setFavorite = useCallback((id: string) => {
    const isFav = !!cardsRef.current.find(c => c.id === id)?.is_favorite
    updateCard(id, { is_favorite: !isFav })
  }, [updateCard])

  const setShowcase = useCallback((id: string) => {
    const isShow = !!cardsRef.current.find(c => c.id === id)?.is_showcase
    updateCard(id, { is_showcase: !isShow })
  }, [updateCard])

  const value = useMemo(() => ({
    cards, sales, loading,
    addCard, updateCard, removeCard, sellCard, setFavorite, setShowcase,
  }), [cards, sales, loading, addCard, updateCard, removeCard, sellCard, setFavorite, setShowcase])

  return (
    <CollectionContext.Provider value={value}>
      {children}
    </CollectionContext.Provider>
  )
}

export function useCollection() {
  const ctx = useContext(CollectionContext)
  if (!ctx) throw new Error('useCollection must be used within CollectionProvider')
  return ctx
}
