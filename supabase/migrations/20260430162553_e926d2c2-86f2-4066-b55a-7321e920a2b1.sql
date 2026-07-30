-- Tabela de prints virais
CREATE TABLE public.print_virals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Print viral',
  image_path TEXT NOT NULL,
  project_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.print_virals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own print_virals select" ON public.print_virals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own print_virals insert" ON public.print_virals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own print_virals update" ON public.print_virals
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own print_virals delete" ON public.print_virals
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER print_virals_touch_updated_at
  BEFORE UPDATE ON public.print_virals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_print_virals_user_created ON public.print_virals(user_id, created_at DESC);

-- Bucket de imagens
INSERT INTO storage.buckets (id, name, public) VALUES ('print-virals', 'print-virals', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (path: {user_id}/...)
CREATE POLICY "Users can view own print viral images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'print-virals' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own print viral images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'print-virals' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own print viral images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'print-virals' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own print viral images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'print-virals' AND auth.uid()::text = (storage.foldername(name))[1]);