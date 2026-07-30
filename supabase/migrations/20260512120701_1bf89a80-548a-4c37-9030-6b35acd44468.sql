CREATE TABLE public.shared_wireframes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  elements JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_wireframes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shared wireframes"
ON public.shared_wireframes FOR SELECT
USING (true);

CREATE POLICY "Anyone can create shared wireframes"
ON public.shared_wireframes FOR INSERT
WITH CHECK (true);

CREATE INDEX idx_shared_wireframes_slug ON public.shared_wireframes(slug);