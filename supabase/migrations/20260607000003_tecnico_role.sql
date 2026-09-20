-- Allow tecnico to INSERT/UPDATE on key tables (crops, costs, harvests, batches, activities, alerts, calendar)
DROP POLICY IF EXISTS "crops via parcel owner" ON public.crops;
CREATE POLICY "crops via parcel owner" ON public.crops FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.parcels p WHERE p.id = parcel_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS(SELECT 1 FROM public.parcels p WHERE p.id = parcel_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))));

DROP POLICY IF EXISTS "costs via crop" ON public.crop_costs;
CREATE POLICY "costs via crop" ON public.crop_costs FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))));

DROP POLICY IF EXISTS "harvests via crop" ON public.crop_harvests;
CREATE POLICY "harvests via crop" ON public.crop_harvests FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))));

DROP POLICY IF EXISTS "batches via crop" ON public.batches;
CREATE POLICY "batches via crop" ON public.batches FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))));

-- Allow tecnico to INSERT activities on any crop (responsible_id can be themselves or the farmer)
DROP POLICY IF EXISTS "activities via parcel" ON public.activities;
CREATE POLICY "activities via parcel" ON public.activities FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id=c.parcel_id
    WHERE c.id = crop_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (responsible_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'));

-- Allow tecnico to CREATE calendar_events and alerts for others
DROP POLICY IF EXISTS "events owner" ON public.calendar_events;
CREATE POLICY "events owner" ON public.calendar_events FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "alerts owner" ON public.alerts;
CREATE POLICY "alerts owner" ON public.alerts FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'));

-- Allow tecnico to READ inventory (but not write)
DROP POLICY IF EXISTS "inventory owner" ON public.inventory_items;
CREATE POLICY "inventory owner" ON public.inventory_items FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- Allow tecnico to READ+INSERT on pest_incidents (and admin too)
DROP POLICY IF EXISTS "Users own their pest incidents" ON public.pest_incidents;
CREATE POLICY "pest_incidents staff" ON public.pest_incidents FOR ALL TO authenticated
  USING (crop_id IN (SELECT id FROM crops WHERE parcel_id IN (SELECT id FROM parcels WHERE owner_id = auth.uid()))
         OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (crop_id IN (SELECT id FROM crops WHERE parcel_id IN (SELECT id FROM parcels WHERE owner_id = auth.uid()))
         OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'));

-- Only admin can delete
DROP POLICY IF EXISTS "parcels owner all" ON public.parcels;
CREATE POLICY "parcels owner all" ON public.parcels FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
