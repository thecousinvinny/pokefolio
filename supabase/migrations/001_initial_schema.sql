-- CATCHM · Initial Schema
-- Run this in your Supabase SQL editor: https://supabase.com/dashboard/project/ydbcfvernfothrukmyty/sql

-- ── Pokemon card collection ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pokemon_cards (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- TCG identity
  tcg_id            TEXT NOT NULL,
  name              TEXT NOT NULL,
  set_name          TEXT NOT NULL,
  set_code          TEXT,
  set_number        TEXT,
  artist            TEXT,
  supertype         TEXT DEFAULT 'Pokémon',
  types             TEXT[],
  rarity            TEXT,
  image_sm          TEXT,
  image_lg          TEXT,
  language          TEXT DEFAULT 'EN',
  flavor_text       TEXT,
  set_printed_total INTEGER,
  set_release_date  TEXT,
  tcgplayer_url     TEXT,

  -- Pricing
  market_price      NUMERIC(10,2),
  market_low        NUMERIC(10,2),
  market_mid        NUMERIC(10,2),
  market_high       NUMERIC(10,2),
  market_direct_low NUMERIC(10,2),
  price_yesterday   NUMERIC(10,2),
  market_at_buy     NUMERIC(10,2),
  price_updated_at  TIMESTAMPTZ,

  -- Collection metadata
  status            TEXT NOT NULL DEFAULT 'owned'
                    CHECK (status IN ('owned', 'wishlist', 'for_sale')),
  condition         TEXT NOT NULL DEFAULT 'NM'
                    CHECK (condition IN ('NM', 'LP', 'MP', 'HP', 'DMG')),
  price_paid        NUMERIC(10,2),
  bought_from       TEXT,
  target_price      NUMERIC(10,2),
  alerts_enabled    BOOLEAN DEFAULT false,
  is_favorite       BOOLEAN DEFAULT false,
  is_showcase       BOOLEAN DEFAULT false,
  date_added        TIMESTAMPTZ DEFAULT NOW(),
  notes             TEXT,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Sales / trades ledger ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pokemon_sales (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  tcg_id          TEXT NOT NULL,
  card_name       TEXT NOT NULL,
  set_name        TEXT,
  image_sm        TEXT,
  card_snapshot   JSONB,
  sale_type       TEXT DEFAULT 'sale' CHECK (sale_type IN ('sale', 'gift')),

  date_sold       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sold_price      NUMERIC(10,2) NOT NULL,
  fees            NUMERIC(10,2) DEFAULT 0,
  shipping        NUMERIC(10,2) DEFAULT 0,
  cost_basis      NUMERIC(10,2) DEFAULT 0,
  net_profit      NUMERIC(10,2) GENERATED ALWAYS AS
                    (sold_price - fees - shipping - cost_basis) STORED,

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_user_id   ON pokemon_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_status    ON pokemon_cards(user_id, status);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_tcg_id    ON pokemon_cards(tcg_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_sales_user_id   ON pokemon_sales(user_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_sales_date      ON pokemon_sales(user_id, date_sold DESC);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE pokemon_cards  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pokemon_sales  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own cards"
  ON pokemon_cards FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own sales"
  ON pokemon_sales FOR ALL
  USING (auth.uid() = user_id);

-- ── Auto-update updated_at ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER pokemon_cards_updated_at
  BEFORE UPDATE ON pokemon_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
