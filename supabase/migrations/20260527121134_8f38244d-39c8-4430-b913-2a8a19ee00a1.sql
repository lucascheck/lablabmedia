
DROP POLICY IF EXISTS "Users update own task columns" ON public.task_columns;
CREATE POLICY "Users update own task columns" ON public.task_columns
FOR UPDATE USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users update own task cards" ON public.task_cards;
CREATE POLICY "Users update own task cards" ON public.task_cards
FOR UPDATE USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'));
