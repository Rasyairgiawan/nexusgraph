-- NexusGraph (STACK 2026 Hackathon - Case 1: Smarter Campus and Learning)
-- Consolidated Supabase Schema + Anti-Ghost Claim System (gap_claims).
-- Note: Claim status & summaries are derived from public.gap_claims rather than stored directly on theses.

CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Extend public.theses metadata (provenance & findings; no direct gap_status/claimed_by additions)
ALTER TABLE public.theses
  ADD COLUMN IF NOT EXISTS key_findings text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'campus_repo',
  ADD COLUMN IF NOT EXISTS verified_by text,
  ADD COLUMN IF NOT EXISTS verified_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS university text;

UPDATE public.theses
SET key_findings = COALESCE(key_findings, limitation)
WHERE key_findings IS NULL AND limitation IS NOT NULL;

-- 2. Anti-Ghost Claim Research Gap Table
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

-- 3. Unified User Profiles (no Role field)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  institution text NOT NULL DEFAULT '',
  major text NOT NULL DEFAULT '',
  nim text NOT NULL DEFAULT '',
  research_interests text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Research Projects Workspace
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_theses (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  thesis_id uuid NOT NULL REFERENCES public.theses(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '',
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, thesis_id)
);

-- 5. AI Assistant Conversations & Grounded Messages
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New Research Chat',
  query_context text NOT NULL DEFAULT '',
  year_filter text NOT NULL DEFAULT 'all',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_thesis_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Enable Row Level Security
ALTER TABLE public.gap_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_theses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read gap claims' AND tablename = 'gap_claims') THEN
    CREATE POLICY "Public read gap claims" ON public.gap_claims
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners insert own gap claims' AND tablename = 'gap_claims') THEN
    CREATE POLICY "Owners insert own gap claims" ON public.gap_claims
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners update own gap claims' AND tablename = 'gap_claims') THEN
    CREATE POLICY "Owners update own gap claims" ON public.gap_claims
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own profile' AND tablename = 'profiles') THEN
    CREATE POLICY "Users manage own profile" ON public.profiles
      FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own projects' AND tablename = 'projects') THEN
    CREATE POLICY "Users manage own projects" ON public.projects
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own project theses' AND tablename = 'project_theses') THEN
    CREATE POLICY "Users manage own project theses" ON public.project_theses
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own ai conversations' AND tablename = 'ai_conversations') THEN
    CREATE POLICY "Users manage own ai conversations" ON public.ai_conversations
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own ai messages' AND tablename = 'ai_messages') THEN
    CREATE POLICY "Users manage own ai messages" ON public.ai_messages
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
      );
  END IF;
END $$;

-- 7. Vector search RPC
DROP FUNCTION IF EXISTS public.match_theses(vector(768), float, int);
CREATE OR REPLACE FUNCTION public.match_theses(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.45,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  file_name text,
  title text,
  author text,
  year int,
  problem text,
  method text,
  dataset text,
  limitation text,
  key_findings text,
  future_work text,
  is_verified boolean,
  verified_by text,
  source_url text,
  source_type text,
  uploaded_by uuid,
  university text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    t.id,
    t.file_name,
    t.title,
    t.author,
    t.year,
    t.problem,
    t.method,
    t.dataset,
    t.limitation,
    COALESCE(t.key_findings, t.limitation) AS key_findings,
    t.future_work,
    t.is_verified,
    t.verified_by,
    t.source_url,
    COALESCE(t.source_type, 'campus_repo') AS source_type,
    t.uploaded_by,
    t.university,
    1 - (t.embedding <=> query_embedding) AS similarity
  FROM public.theses t
  WHERE t.embedding IS NOT NULL
    AND 1 - (t.embedding <=> query_embedding) > match_threshold
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
$$;
