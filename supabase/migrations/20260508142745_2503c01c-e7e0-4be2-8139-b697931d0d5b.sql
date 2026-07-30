
ALTER TABLE public.post_frases
  ADD COLUMN IF NOT EXISTS project_data jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

ALTER TABLE public.post_noticias
  ADD COLUMN IF NOT EXISTS project_data jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

ALTER TABLE public.post_simples
  ADD COLUMN IF NOT EXISTS project_data jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

CREATE POLICY "own post_frases update" ON public.post_frases
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "own post_noticias update" ON public.post_noticias
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "own post_simples update" ON public.post_simples
  FOR UPDATE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS touch_post_frases ON public.post_frases;
CREATE TRIGGER touch_post_frases BEFORE UPDATE ON public.post_frases
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_post_noticias ON public.post_noticias;
CREATE TRIGGER touch_post_noticias BEFORE UPDATE ON public.post_noticias
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_post_simples ON public.post_simples;
CREATE TRIGGER touch_post_simples BEFORE UPDATE ON public.post_simples
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
