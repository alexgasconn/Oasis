-- Migration: 0001_create_ratings
-- Creates the ratings table, aggregate view, indexes, and RLS policies.

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

CREATE INDEX IF NOT EXISTS ratings_fountain_id_idx
  ON public.ratings (fountain_id);

CREATE OR REPLACE VIEW public.fountain_rating_aggregates AS
SELECT
  fountain_id,
  COUNT(*)::int                      AS rating_count,
  ROUND(AVG(rating)::numeric, 2)     AS rating_avg
FROM public.ratings
GROUP BY fountain_id;

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- Policies (Variant A by default)
CREATE POLICY "ratings_select_public"
  ON public.ratings
  FOR SELECT
  USING (true);

CREATE POLICY "ratings_insert_authenticated"
  ON public.ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.role() = 'authenticated'
  );

CREATE POLICY "ratings_delete_own"
  ON public.ratings
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
