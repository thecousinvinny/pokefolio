'use client'
import {
  createContext, useContext, useEffect, useRef, useState, useCallback, useMemo,
  type ReactNode
} from 'react'
import type { PokemonCard, SaleRecord } from '@/types'

const CARDS_KEY = 'catchm_cards_v1'
const SALES_KEY = 'catchm_sales_v1'

function readLS<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') as T[] } catch { return [] }
}

function writeLS<T>(key: string, data: T[]): void {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch { /* quota exceeded */ }
}

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
  setShowcase: (id: string) => void
  toggleAlert: (id: string) => void
}

const CollectionContext = createContext<CollectionContextType | null>(null)

export function CollectionProvider({ children }: { children: ReactNode }) {
  const [cards, setCards] = useState<PokemonCard[]>([])
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [loading, setLoading] = useState(true)

  const cardsRef = useRef<PokemonCard[]>([])
  useEffect(() => { cardsRef.current = cards }, [cards])

  // Initial load from localStorage
  useEffect(() => {
    setCards(readLS<PokemonCard>(CARDS_KEY))
    setSales(readLS<SaleRecord>(SALES_KEY))
    setLoading(false)
  }, [])

  // Persist cards to localStorage on every change (skip during initial empty state)
  const initialized = useRef(false)
  useEffect(() => {
    if (!initialized.current) { initialized.current = true; return }
    writeLS(CARDS_KEY, cards)
  }, [cards])

  useEffect(() => {
    writeLS(SALES_KEY, sales)
  }, [sales])

  const addCard = useCallback((cardData: Omit<PokemonCard, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    const now = new Date().toISOString()
    const newCard: PokemonCard = {
      ...cardData,
      id: crypto.randomUUID(),
      user_id: 'local',
      created_at: now,
      updated_at: now,
    }
    setCards(prev => [newCard, ...prev])
  }, [])

  const updateCard = useCallback((id: string, updates: Partial<PokemonCard>) => {
    const now = new Date().toISOString()
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...updates, updated_at: now } : c))
  }, [])

  const removeCard = useCallback((id: string) => {
    setCards(prev => prev.filter(c => c.id !== id))
  }, [])

  const sellCard = useCallback((card: PokemonCard, payload: SellPayload) => {
    const now = new Date().toISOString()
    const sale: SaleRecord = {
      id: crypto.randomUUID(),
      user_id: 'local',
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
    setSales(prev => [sale, ...prev])
  }, [])

  const giftCard = useCallback((card: PokemonCard) => {
    sellCard(card, { sold_price: 0, fees: 0, shipping: 0, sale_type: 'gift' })
  }, [sellCard])

  const setFavorite = useCallback((id: string) => {
    const isFav = !!cardsRef.current.find(c => c.id === id)?.is_favorite
    setCards(prev => prev.map(c => ({ ...c, is_favorite: c.id === id ? !isFav : false })))
  }, [])

  const setShowcase = useCallback((id: string) => {
    const isShow = !!cardsRef.current.find(c => c.id === id)?.is_showcase
    setCards(prev => prev.map(c => ({ ...c, is_showcase: c.id === id ? !isShow : false })))
  }, [])

  const toggleAlert = useCallback((id: string) => {
    const card = cardsRef.current.find(c => c.id === id)
    if (!card) return
    const newVal = !card.alerts_enabled
    setCards(prev => prev.map(c => c.id === id ? { ...c, alerts_enabled: newVal } : c))
  }, [])

  const refresh = useCallback(() => {
    setCards(readLS<PokemonCard>(CARDS_KEY))
    setSales(readLS<SaleRecord>(SALES_KEY))
  }, [])

  const value = useMemo(() => ({
    cards, sales, loading, refresh,
    addCard, updateCard, removeCard, sellCard, giftCard, setFavorite, setShowcase, toggleAlert,
  }), [cards, sales, loading, refresh, addCard, updateCard, removeCard, sellCard, giftCard, setFavorite, setShowcase, toggleAlert])

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
