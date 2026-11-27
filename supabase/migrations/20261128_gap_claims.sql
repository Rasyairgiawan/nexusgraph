-- Migration: Anti-Ghost Claim Research Gap system (gap_claims)
-- Soft-lock multi-user claims, two statuses (exploring / in_progress / released),
-- and 30-day automatic expiry evaluated at read time without deleting historical rows.

CREATE TABLE IF NOT EXISTS public.gap_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thesis_id uuid NOT NULL REFERENCES public.theses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  planned_angle text NOT NULL,
  status text NOT NULL DEFAULT 'exploring' CHECK (status IN ('exploring', 'in_progress', 'released')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 days')
);

CREATE INDEX IF NOT EXISTS idx_gap_claims_thesis_id ON public.gap_claims(thesis_id);
CREATE INDEX IF NOT EXISTS idx_gap_claims_user_id ON public.gap_claims(user_id);

-- Row Level Security:
-- Claims are publicly readable (displayed in Graph, Table, and Drawer),
-- while only the claim owner (auth.uid() = user_id) can insert, modify, or release.
ALTER TABLE public.gap_claims ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'gap_claims' AND policyname = 'Public read gap claims'
  ) THEN
    CREATE POLICY "Public read gap claims" ON public.gap_claims
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'gap_claims' AND policyname = 'Owners insert own gap claims'
  ) THEN
    CREATE POLICY "Owners insert own gap claims" ON public.gap_claims
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'gap_claims' AND policyname = 'Owners update own gap claims'
  ) THEN
    CREATE POLICY "Owners update own gap claims" ON public.gap_claims
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

