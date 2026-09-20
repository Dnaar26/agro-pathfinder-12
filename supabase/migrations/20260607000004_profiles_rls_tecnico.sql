-- Allow tecnico and admin to read all profiles (needed for farmer filter, owner display)
DROP POLICY IF EXISTS "profile staff read all" ON public.profiles;
CREATE POLICY "profile staff read all" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'tecnico') OR public.has_role(auth.uid(), 'admin'));
