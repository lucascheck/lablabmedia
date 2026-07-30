DROP POLICY IF EXISTS "own roteiros delete" ON public.roteiros;

CREATE POLICY "admins delete roteiros"
ON public.roteiros
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));