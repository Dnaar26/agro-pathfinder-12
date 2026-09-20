-- Fix inventory_movements: allow tecnico to read/write (via parcel ownership chain)
DROP POLICY IF EXISTS "movements owner" ON public.inventory_movements;
CREATE POLICY "movements owner" ON public.inventory_movements FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.inventory_items i WHERE i.id = item_id
    AND (i.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS(SELECT 1 FROM public.inventory_items i WHERE i.id = item_id
    AND (i.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))));

-- Allow tecnico to update farmer profiles (phone, full_name)
CREATE POLICY "profile staff update" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'tecnico') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = id OR public.has_role(auth.uid(), 'tecnico') OR public.has_role(auth.uid(), 'admin'));

-- Drop redundant profiles staff read policy (20260607000004 already has a more complete one)
DROP POLICY IF EXISTS "profiles staff read" ON public.profiles;
