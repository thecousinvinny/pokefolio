-- CATCHM · Price Snapshots
-- One market-price row per catalog card per day, written by the daily
-- snapshot-prices GitHub Action. Builds real price history over time so the
-- card sparklines can switch from synthetic to actual data once enough days
-- accumulate. Public read; writes via service_role only.

CREATE TABLE IF NOT EXISTS price_snapshots (
  card_id  TEXT NOT NULL,          -- card_catalog.id, e.g. "swsh9-100"
  day      DATE NOT NULL,
  market   NUMERIC(10,2),
  PRIMARY KEY (card_id, day)
);

-- card history lookups: WHERE card_id = $1 ORDER BY day
CREATE INDEX IF NOT EXISTS idx_snapshots_card_day ON price_snapshots (card_id, day);

ALTER TABLE price_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Snapshots are publicly readable" ON price_snapshots;
CREATE POLICY "Snapshots are publicly readable"
  ON price_snapshots FOR SELECT
  USING (true);
