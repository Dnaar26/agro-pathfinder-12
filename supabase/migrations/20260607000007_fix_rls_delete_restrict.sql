-- Fix RLS: split FOR ALL policies so DELETE is restricted to admin (or owner)
-- PostgreSQL DELETE only checks USING clause; WITH CHECK is ignored for DELETE
-- Previous FOR ALL policies gave tecnico unintended DELETE access

-- PARCELS: owner can manage, tecnico can read, admin can do all
DROP POLICY IF EXISTS "parcels owner all" ON public.parcels;
CREATE POLICY "parcels select" ON public.parcels FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "parcels insert" ON public.parcels FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "parcels update" ON public.parcels FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "parcels delete" ON public.parcels FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- CROPS: tecnico can read/write but not delete
DROP POLICY IF EXISTS "crops via parcel owner" ON public.crops;
CREATE POLICY "crops select" ON public.crops FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.parcels p WHERE p.id = parcel_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "crops insert" ON public.crops FOR INSERT TO authenticated
  WITH CHECK (EXISTS(SELECT 1 FROM public.parcels p WHERE p.id = parcel_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "crops update" ON public.crops FOR UPDATE TO authenticated
  USING (EXISTS(SELECT 1 FROM public.parcels p WHERE p.id = parcel_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS(SELECT 1 FROM public.parcels p WHERE p.id = parcel_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "crops delete" ON public.crops FOR DELETE TO authenticated
  USING (EXISTS(SELECT 1 FROM public.parcels p WHERE p.id = parcel_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- CROP COSTS
DROP POLICY IF EXISTS "costs via crop" ON public.crop_costs;
CREATE POLICY "costs select" ON public.crop_costs FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "costs insert" ON public.crop_costs FOR INSERT TO authenticated
  WITH CHECK (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "costs update" ON public.crop_costs FOR UPDATE TO authenticated
  USING (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "costs delete" ON public.crop_costs FOR DELETE TO authenticated
  USING (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- CROP HARVESTS
DROP POLICY IF EXISTS "harvests via crop" ON public.crop_harvests;
CREATE POLICY "harvests select" ON public.crop_harvests FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "harvests insert" ON public.crop_harvests FOR INSERT TO authenticated
  WITH CHECK (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "harvests update" ON public.crop_harvests FOR UPDATE TO authenticated
  USING (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "harvests delete" ON public.crop_harvests FOR DELETE TO authenticated
  USING (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- BATCHES
DROP POLICY IF EXISTS "batches via crop" ON public.batches;
CREATE POLICY "batches select" ON public.batches FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "batches insert" ON public.batches FOR INSERT TO authenticated
  WITH CHECK (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "batches update" ON public.batches FOR UPDATE TO authenticated
  USING (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "batches delete" ON public.batches FOR DELETE TO authenticated
  USING (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- ACTIVITIES
DROP POLICY IF EXISTS "activities via parcel" ON public.activities;
CREATE POLICY "activities select" ON public.activities FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id=c.parcel_id WHERE c.id = crop_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "activities insert" ON public.activities FOR INSERT TO authenticated
  WITH CHECK (responsible_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "activities update" ON public.activities FOR UPDATE TO authenticated
  USING (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id=c.parcel_id WHERE c.id = crop_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (responsible_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "activities delete" ON public.activities FOR DELETE TO authenticated
  USING (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id=c.parcel_id WHERE c.id = crop_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- CALENDAR EVENTS
DROP POLICY IF EXISTS "events owner" ON public.calendar_events;
CREATE POLICY "events select" ON public.calendar_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "events insert" ON public.calendar_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "events update" ON public.calendar_events FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "events delete" ON public.calendar_events FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ALERTS
DROP POLICY IF EXISTS "alerts owner" ON public.alerts;
CREATE POLICY "alerts select" ON public.alerts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "alerts insert" ON public.alerts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "alerts update" ON public.alerts FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "alerts delete" ON public.alerts FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- INVENTORY ITEMS
DROP POLICY IF EXISTS "inventory owner" ON public.inventory_items;
CREATE POLICY "inventory select" ON public.inventory_items FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "inventory insert" ON public.inventory_items FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "inventory update" ON public.inventory_items FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "inventory delete" ON public.inventory_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- PEST INCIDENTS (tecnico can manage but not delete)
DROP POLICY IF EXISTS "pest_incidents staff" ON public.pest_incidents;
CREATE POLICY "pest_incidents select" ON public.pest_incidents FOR SELECT TO authenticated
  USING (crop_id IN (SELECT id FROM crops WHERE parcel_id IN (SELECT id FROM parcels WHERE owner_id = auth.uid()))
         OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "pest_incidents insert" ON public.pest_incidents FOR INSERT TO authenticated
  WITH CHECK (crop_id IN (SELECT id FROM crops WHERE parcel_id IN (SELECT id FROM parcels WHERE owner_id = auth.uid()))
         OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "pest_incidents update" ON public.pest_incidents FOR UPDATE TO authenticated
  USING (crop_id IN (SELECT id FROM crops WHERE parcel_id IN (SELECT id FROM parcels WHERE owner_id = auth.uid()))
         OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (crop_id IN (SELECT id FROM crops WHERE parcel_id IN (SELECT id FROM parcels WHERE owner_id = auth.uid()))
         OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "pest_incidents delete" ON public.pest_incidents FOR DELETE TO authenticated
  USING (crop_id IN (SELECT id FROM crops WHERE parcel_id IN (SELECT id FROM parcels WHERE owner_id = auth.uid()))
         OR public.has_role(auth.uid(),'admin'));
