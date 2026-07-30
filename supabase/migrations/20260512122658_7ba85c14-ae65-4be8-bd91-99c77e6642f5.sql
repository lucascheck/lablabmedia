CREATE TABLE public.shared_wireframe_panels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  wires jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_wireframe_panels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shared panels"
ON public.shared_wireframe_panels FOR SELECT USING (true);

CREATE POLICY "Anyone can create shared panels"
ON public.shared_wireframe_panels FOR INSERT WITH CHECK (true);