
-- Carousels
CREATE TABLE public.carousels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled carousel',
  username TEXT NOT NULL DEFAULT 'your_username',
  avatar_url TEXT,
  caption TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT 'light',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.carousels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own carousels select" ON public.carousels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own carousels insert" ON public.carousels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own carousels update" ON public.carousels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own carousels delete" ON public.carousels FOR DELETE USING (auth.uid() = user_id);

-- Slides
CREATE TABLE public.carousel_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carousel_id UUID NOT NULL REFERENCES public.carousels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  image_path TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_carousel_slides_carousel_id ON public.carousel_slides(carousel_id, position);

ALTER TABLE public.carousel_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own slides select" ON public.carousel_slides FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own slides insert" ON public.carousel_slides FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own slides update" ON public.carousel_slides FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own slides delete" ON public.carousel_slides FOR DELETE USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER carousels_touch_updated_at
BEFORE UPDATE ON public.carousels
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('carousel-images', 'carousel-images', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users can manage files inside a folder named with their user_id
CREATE POLICY "carousel images select own" ON storage.objects FOR SELECT
USING (bucket_id = 'carousel-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "carousel images insert own" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'carousel-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "carousel images update own" ON storage.objects FOR UPDATE
USING (bucket_id = 'carousel-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "carousel images delete own" ON storage.objects FOR DELETE
USING (bucket_id = 'carousel-images' AND auth.uid()::text = (storage.foldername(name))[1]);
