-- Add public sharing fields to carousels
ALTER TABLE public.carousels
  ADD COLUMN is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN public_slug text UNIQUE;

CREATE INDEX idx_carousels_public_slug ON public.carousels(public_slug) WHERE public_slug IS NOT NULL;

-- Allow anyone (anon + authenticated) to read carousels that are marked public
CREATE POLICY "public carousels readable by anyone"
ON public.carousels
FOR SELECT
TO anon, authenticated
USING (is_public = true AND public_slug IS NOT NULL);

-- Allow anyone to read slides belonging to public carousels
CREATE POLICY "public carousel slides readable by anyone"
ON public.carousel_slides
FOR SELECT
TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.carousels c
  WHERE c.id = carousel_slides.carousel_id
    AND c.is_public = true
    AND c.public_slug IS NOT NULL
));

-- Allow public read access to images in storage for public carousels
CREATE POLICY "public carousel images readable by anyone"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'carousel-images'
  AND EXISTS (
    SELECT 1 FROM public.carousel_slides s
    JOIN public.carousels c ON c.id = s.carousel_id
    WHERE s.image_path = storage.objects.name
      AND c.is_public = true
      AND c.public_slug IS NOT NULL
  )
);