-- CATCHM · Card Catalog
-- A local mirror of modern-era Pokémon cards (SV + SWSH) for instant search.
-- Static identity/art only — prices stay live (tcgcsv / pokemontcg.io).
-- Seeded by scripts/seed-catalog.mjs. Public read; writes via service_role only.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS card_catalog (
  id                TEXT PRIMARY KEY,          -- TCG card id, e.g. "sv4-245"
  name              TEXT NOT NULL,
  supertype         TEXT,                      -- Pokémon | Trainer | Energy
  types             TEXT[],
  rarity            TEXT,
  number            TEXT,
  printed_total     INTEGER,
  set_id            TEXT,
  set_name          TEXT,
  set_release_date  DATE,
  image_sm          TEXT,
  image_lg          TEXT,
  artist            TEXT,
  hp                TEXT,
  flavor_text       TEXT,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Fuzzy + prefix name search
CREATE INDEX IF NOT EXISTS idx_catalog_name_trgm
  ON card_catalog USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_catalog_setname_trgm
  ON card_catalog USING gin (set_name gin_trgm_ops);
-- Default sort: newest set first
CREATE INDEX IF NOT EXISTS idx_catalog_release
  ON card_catalog (set_release_date DESC NULLS LAST);

-- Public reference data: anyone may read, nobody may write through the anon key.
-- The seed script uses the service_role key, which bypasses RLS.
ALTER TABLE card_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Catalog is publicly readable" ON card_catalog;
CREATE POLICY "Catalog is publicly readable"
  ON card_catalog FOR SELECT
  USING (true);
