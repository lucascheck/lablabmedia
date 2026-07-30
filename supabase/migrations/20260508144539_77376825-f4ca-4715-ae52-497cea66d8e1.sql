
ALTER TABLE public.carousels ADD COLUMN IF NOT EXISTS project_data jsonb;

CREATE TABLE IF NOT EXISTS public.whatsapp_prints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Print WhatsApp',
  image_path text NOT NULL,
  project_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_prints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own whatsapp_prints select" ON public.whatsapp_prints FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own whatsapp_prints insert" ON public.whatsapp_prints FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own whatsapp_prints update" ON public.whatsapp_prints FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own whatsapp_prints delete" ON public.whatsapp_prints FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER touch_whatsapp_prints BEFORE UPDATE ON public.whatsapp_prints
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO storage.buckets (id, name, public)
  VALUES ('whatsapp-prints', 'whatsapp-prints', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "own wa-prints select" ON storage.objects FOR SELECT
  USING (bucket_id = 'whatsapp-prints' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own wa-prints insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'whatsapp-prints' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own wa-prints update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'whatsapp-prints' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own wa-prints delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'whatsapp-prints' AND auth.uid()::text = (storage.foldername(name))[1]);
