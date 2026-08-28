-- =============================================================================
-- Migration: 0001_create_ratings
-- Creates the ratings table, aggregate view, indexes, and RLS policies.
-- Run this in the Supabase SQL Editor (or via supabase db push).
-- =============================================================================

-- ── 1. Table ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ratings (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fountain_id  text        NOT NULL,
  name         text        NULL,
  rating       smallint    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      text        NULL,
  lat          numeric     NULL,
  lng          numeric     NULL,
  metadata     jsonb       NULL,
  user_id      uuid        NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Index ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS ratings_fountain_id_idx
  ON public.ratings (fountain_id);

-- ── 3. Aggregate view ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.fountain_rating_aggregates AS
SELECT
  fountain_id,
  COUNT(*)::int                      AS rating_count,
  ROUND(AVG(rating)::numeric, 2)     AS rating_avg
FROM public.ratings
GROUP BY fountain_id;

-- ── 4. Enable Row Level Security ──────────────────────────────────────────────
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- VARIANT A – Authenticated users only
-- Use this when you require a Supabase account to submit ratings.
-- =============================================================================

-- A-1: Anyone (including anonymous / unauthenticated) can read ratings.
CREATE POLICY "ratings_select_public"
  ON public.ratings
  FOR SELECT
  USING (true);

-- A-2: Only authenticated users can insert their own ratings.
CREATE POLICY "ratings_insert_authenticated"
  ON public.ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.role() = 'authenticated'
    -- Optionally enforce that user_id matches the calling user:
    -- AND (user_id IS NULL OR user_id = auth.uid())
  );

-- A-3: Users can delete only their own ratings.
CREATE POLICY "ratings_delete_own"
  ON public.ratings
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- VARIANT B – Allow anonymous inserts via a trusted Edge Function
--
-- Steps:
--   1. Comment out policy A-2 above and enable the policies below.
--   2. Create a Supabase Edge Function (e.g. "submit-rating") that:
--      a. Validates a reCAPTCHA token sent by the client.
--      b. Calls supabaseAdmin.from('ratings').insert(...) using the
--         service_role key (never exposed to the browser).
--   3. The edge function bypasses RLS because it uses service_role.
--   4. Keep policy B-1 (SELECT) and B-3 (DELETE own) as-is.
--
-- Uncomment below to use Variant B:
-- =============================================================================
--
-- CREATE POLICY "ratings_insert_edge_function_only"
--   ON public.ratings
--   FOR INSERT
--   WITH CHECK (false);  -- direct client inserts are always denied
--
-- (The Edge Function uses service_role and therefore bypasses RLS entirely.)

-- =============================================================================
-- Optional: restrict UPDATE (ratings are immutable once submitted)
-- =============================================================================
-- No UPDATE policy is defined, so updates are denied by default under RLS.
