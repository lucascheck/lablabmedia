
CREATE TABLE public.roteiros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Novo roteiro',
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.roteiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own roteiros select" ON public.roteiros FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own roteiros insert" ON public.roteiros FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own roteiros update" ON public.roteiros FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own roteiros delete" ON public.roteiros FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER roteiros_touch_updated_at
BEFORE UPDATE ON public.roteiros
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.shared_roteiros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_roteiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shared roteiros" ON public.shared_roteiros FOR SELECT USING (true);
CREATE POLICY "Anyone can create shared roteiros" ON public.shared_roteiros FOR INSERT WITH CHECK (true);
