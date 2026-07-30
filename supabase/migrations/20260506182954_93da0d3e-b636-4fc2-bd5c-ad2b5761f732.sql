
-- Post Notícia history
CREATE TABLE public.post_noticias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Post notícia',
  image_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.post_noticias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own post_noticias select" ON public.post_noticias FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own post_noticias insert" ON public.post_noticias FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own post_noticias delete" ON public.post_noticias FOR DELETE USING (auth.uid() = user_id);

-- Post Simples history
CREATE TABLE public.post_simples (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Post simples',
  image_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.post_simples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own post_simples select" ON public.post_simples FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own post_simples insert" ON public.post_simples FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own post_simples delete" ON public.post_simples FOR DELETE USING (auth.uid() = user_id);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('post-noticias', 'post-noticias', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('post-simples', 'post-simples', false);

-- Storage policies for post-noticias
CREATE POLICY "Users can upload own post-noticias" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'post-noticias' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own post-noticias" ON storage.objects FOR SELECT USING (bucket_id = 'post-noticias' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own post-noticias" ON storage.objects FOR DELETE USING (bucket_id = 'post-noticias' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for post-simples
CREATE POLICY "Users can upload own post-simples" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'post-simples' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own post-simples" ON storage.objects FOR SELECT USING (bucket_id = 'post-simples' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own post-simples" ON storage.objects FOR DELETE USING (bucket_id = 'post-simples' AND auth.uid()::text = (storage.foldername(name))[1]);
