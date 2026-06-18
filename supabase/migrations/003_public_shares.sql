-- CATCHM · Public Share Links
-- Run this in your Supabase SQL editor:
-- https://supabase.com/dashboard/project/ydbcfvernfothrukmyty/sql

CREATE TABLE IF NOT EXISTS public.public_shares (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name       TEXT,
  avatar_data        TEXT,
  cards_data         JSONB,   -- snapshot of owned/for_sale cards
  wishlist_data      JSONB,   -- snapshot of wishlist cards
  include_collection BOOLEAN DEFAULT true,
  include_wishlist   BOOLEAN DEFAULT false,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.public_shares ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated visitors) can read a share by its ID
CREATE POLICY "Anyone can read public shares"
  ON public.public_shares FOR SELECT
  USING (true);

-- Only the owner can create / update / delete their share
CREATE POLICY "Users can insert their own share"
  ON public.public_shares FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own share"
  ON public.public_shares FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own share"
  ON public.public_shares FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER public_shares_updated_at
  BEFORE UPDATE ON public.public_shares
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
