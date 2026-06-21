-- CATCHM · Share-link expiry
-- Adds an optional expiry to public_shares and enforces it in the read policy,
-- so an expired link returns nothing at the database level (not just hidden).
-- Run in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/ydbcfvernfothrukmyty/sql

ALTER TABLE public.public_shares
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;   -- NULL = never expires

-- Replace the read policy: expired shares are no longer readable by anyone.
-- (Existing shares have expires_at = NULL, so they keep working until re-generated.)
DROP POLICY IF EXISTS "Anyone can read public shares" ON public.public_shares;

CREATE POLICY "Anyone can read non-expired public shares"
  ON public.public_shares FOR SELECT
  USING (expires_at IS NULL OR expires_at > now());
