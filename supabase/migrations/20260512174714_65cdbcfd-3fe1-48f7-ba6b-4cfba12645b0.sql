CREATE POLICY "admins read all roteiros"
ON public.roteiros
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update all roteiros"
ON public.roteiros
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));