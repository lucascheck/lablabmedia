CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.copy_titulos_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Nova copy',
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.copy_titulos_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own copies" ON public.copy_titulos_videos
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own copies" ON public.copy_titulos_videos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own copies" ON public.copy_titulos_videos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users delete own copies" ON public.copy_titulos_videos
  FOR DELETE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_copy_titulos_videos_updated_at
  BEFORE UPDATE ON public.copy_titulos_videos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
