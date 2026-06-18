-- Add prefs JSONB column to user_profiles for cross-device preference sync
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS prefs JSONB DEFAULT '{}';

-- RLS is inherited from existing policy (all uses auth.uid() = user_id)
