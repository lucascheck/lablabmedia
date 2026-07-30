
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.task_columns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Nova coluna',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_columns TO authenticated;
GRANT ALL ON public.task_columns TO service_role;
ALTER TABLE public.task_columns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own task columns" ON public.task_columns FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users insert own task columns" ON public.task_columns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own task columns" ON public.task_columns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own task columns" ON public.task_columns FOR DELETE USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_task_columns_updated_at BEFORE UPDATE ON public.task_columns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.task_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  column_id UUID NOT NULL REFERENCES public.task_columns(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nova tarefa',
  description TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  due_date TIMESTAMPTZ,
  priority TEXT NOT NULL DEFAULT 'normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_cards TO authenticated;
GRANT ALL ON public.task_cards TO service_role;
ALTER TABLE public.task_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own task cards" ON public.task_cards FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users insert own task cards" ON public.task_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own task cards" ON public.task_cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own task cards" ON public.task_cards FOR DELETE USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_task_cards_updated_at BEFORE UPDATE ON public.task_cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_task_columns_user ON public.task_columns(user_id, position);
CREATE INDEX idx_task_cards_column ON public.task_cards(column_id, position);
