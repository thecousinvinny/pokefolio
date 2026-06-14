'use client'
import {
  createContext, useContext, useEffect, useState, useCallback,
  type ReactNode
} from 'react'
import type { PokemonCard, SaleRecord, CardCondition } from '@/types'

const CARDS_KEY = 'catchm_cards_v1'
const SALES_KEY = 'catchm_sales_v1'

function uuid(): string {
  return crypto.randomUUID()
}

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function saveJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
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
  toggleAlert: (id: string) => void
}

const CollectionContext = createContext<CollectionContextType | null>(null)

export function CollectionProvider({ children }: { children: ReactNode }) {
  const [cards, setCards] = useState<PokemonCard[]>([])
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setCards(loadJSON<PokemonCard[]>(CARDS_KEY, []))
    setSales(loadJSON<SaleRecord[]>(SALES_KEY, []))
    setLoading(false)
  }, [])

  const persist = useCallback((nextCards: PokemonCard[], nextSales: SaleRecord[]) => {
    saveJSON(CARDS_KEY, nextCards)
    saveJSON(SALES_KEY, nextSales)
  }, [])

  const addCard = useCallback((card: Omit<PokemonCard, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    const now = new Date().toISOString()
    const newCard: PokemonCard = {
      ...card,
      id: uuid(),
      user_id: 'local',
      created_at: now,
      updated_at: now,
    }
    setCards(prev => {
      const next = [newCard, ...prev]
      persist(next, sales)
      return next
    })
  }, [persist, sales])

  const updateCard = useCallback((id: string, updates: Partial<PokemonCard>) => {
    setCards(prev => {
      const next = prev.map(c => c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c)
      persist(next, sales)
      return next
    })
  }, [persist, sales])

  const removeCard = useCallback((id: string) => {
    setCards(prev => {
      const next = prev.filter(c => c.id !== id)
      persist(next, sales)
      return next
    })
  }, [persist, sales])

  const sellCard = useCallback((card: PokemonCard, payload: SellPayload) => {
    const sale: SaleRecord = {
      id: uuid(),
      user_id: 'local',
      tcg_id: card.tcg_id,
      card_name: card.name,
      set_name: card.set_name,
      image_sm: card.image_sm,
      card_snapshot: card as unknown as Record<string, unknown>,
      sale_type: payload.sale_type ?? 'sale',
      date_sold: new Date().toISOString(),
      sold_price: payload.sold_price,
      fees: payload.fees,
      shipping: payload.shipping,
      cost_basis: card.price_paid ?? 0,
      net_profit: payload.sold_price - payload.fees - payload.shipping - (card.price_paid ?? 0),
      created_at: new Date().toISOString(),
    }
    setCards(prevCards => {
      const nextCards = prevCards.filter(c => c.id !== card.id)
      setSales(prevSales => {
        const nextSales = [sale, ...prevSales]
        persist(nextCards, nextSales)
        return nextSales
      })
      return nextCards
    })
  }, [persist])

  const giftCard = useCallback((card: PokemonCard) => {
    sellCard(card, { sold_price: 0, fees: 0, shipping: 0, sale_type: 'gift' })
  }, [sellCard])

  const setFavorite = useCallback((id: string) => {
    setCards(prev => {
      const isFav = prev.find(c => c.id === id)?.is_favorite
      const next = prev.map(c => ({
        ...c,
        is_favorite: c.id === id ? !isFav : false,
      }))
      persist(next, sales)
      return next
    })
  }, [persist, sales])

  const toggleAlert = useCallback((id: string) => {
    setCards(prev => {
      const next = prev.map(c =>
        c.id === id ? { ...c, alerts_enabled: !c.alerts_enabled } : c
      )
      persist(next, sales)
      return next
    })
  }, [persist, sales])

  const refresh = useCallback(() => {
    setCards(loadJSON<PokemonCard[]>(CARDS_KEY, []))
    setSales(loadJSON<SaleRecord[]>(SALES_KEY, []))
  }, [])

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
