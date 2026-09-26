-- Production hardening: cache auth.uid() per statement and keep provider secrets server-side.

-- Keep trigger behavior while fixing mutable search_path resolution.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate the owner/staff policies with a statement-stable auth.uid() call.
DROP POLICY IF EXISTS "parcels owner all" ON public.parcels;
CREATE POLICY "parcels owner all" ON public.parcels FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'tecnico') OR public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS "crops via parcel owner" ON public.crops;
CREATE POLICY "crops via parcel owner" ON public.crops FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.parcels p WHERE p.id = parcel_id AND (p.owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'tecnico') OR public.has_role((SELECT auth.uid()), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.parcels p WHERE p.id = parcel_id AND (p.owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'tecnico') OR public.has_role((SELECT auth.uid()), 'admin'))));

DROP POLICY IF EXISTS "activities via parcel" ON public.activities;
CREATE POLICY "activities via parcel" ON public.activities FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id AND (p.owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'tecnico') OR public.has_role((SELECT auth.uid()), 'admin'))))
  WITH CHECK (responsible_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'tecnico') OR public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS "inventory owner" ON public.inventory_items;
CREATE POLICY "inventory owner" ON public.inventory_items FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'tecnico') OR public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS "movements owner" ON public.inventory_movements;
CREATE POLICY "movements owner" ON public.inventory_movements FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.inventory_items i WHERE i.id = item_id AND (i.owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.inventory_items i WHERE i.id = item_id AND (i.owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'))));

DROP POLICY IF EXISTS "push own" ON public.push_subscriptions;
CREATE POLICY "push own" ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "reports own" ON public.scheduled_reports;
CREATE POLICY "reports own" ON public.scheduled_reports FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "ndvi via parcel" ON public.ndvi_cache;
CREATE POLICY "ndvi via parcel" ON public.ndvi_cache FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.parcels p WHERE p.id = parcel_id AND (p.owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'tecnico') OR public.has_role((SELECT auth.uid()), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.parcels p WHERE p.id = parcel_id AND (p.owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'tecnico') OR public.has_role((SELECT auth.uid()), 'admin'))));

DROP POLICY IF EXISTS "weather via parcel" ON public.weather_cache;
CREATE POLICY "weather via parcel" ON public.weather_cache FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.parcels p WHERE p.id = parcel_id AND (p.owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'tecnico') OR public.has_role((SELECT auth.uid()), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.parcels p WHERE p.id = parcel_id AND (p.owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'tecnico') OR public.has_role((SELECT auth.uid()), 'admin'))));

DROP POLICY IF EXISTS "costs via crop" ON public.crop_costs;
CREATE POLICY "costs via crop" ON public.crop_costs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id AND (p.owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'tecnico') OR public.has_role((SELECT auth.uid()), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id AND (p.owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'tecnico') OR public.has_role((SELECT auth.uid()), 'admin'))));

DROP POLICY IF EXISTS "harvests via crop" ON public.crop_harvests;
CREATE POLICY "harvests via crop" ON public.crop_harvests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id AND (p.owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'tecnico') OR public.has_role((SELECT auth.uid()), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id AND (p.owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'tecnico') OR public.has_role((SELECT auth.uid()), 'admin'))));

DROP POLICY IF EXISTS "batches via crop" ON public.batches;
CREATE POLICY "batches via crop" ON public.batches FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id AND (p.owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'tecnico') OR public.has_role((SELECT auth.uid()), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id AND (p.owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'tecnico') OR public.has_role((SELECT auth.uid()), 'admin'))));

DROP POLICY IF EXISTS "events owner" ON public.calendar_events;
CREATE POLICY "events via crop" ON public.calendar_events FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = calendar_events.crop_id AND (p.owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'tecnico') OR public.has_role((SELECT auth.uid()), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = calendar_events.crop_id AND (p.owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'tecnico') OR public.has_role((SELECT auth.uid()), 'admin'))));

DROP POLICY IF EXISTS "alerts owner" ON public.alerts;
CREATE POLICY "alerts owner" ON public.alerts FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'tecnico') OR public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'tecnico') OR public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS "pest_incidents staff" ON public.pest_incidents;
DROP POLICY IF EXISTS "Users own their pest incidents" ON public.pest_incidents;
CREATE POLICY "pest_incidents staff" ON public.pest_incidents FOR ALL TO authenticated
  USING (crop_id IN (SELECT id FROM public.crops WHERE parcel_id IN (SELECT id FROM public.parcels WHERE owner_id = (SELECT auth.uid()))) OR public.has_role((SELECT auth.uid()), 'tecnico') OR public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (crop_id IN (SELECT id FROM public.crops WHERE parcel_id IN (SELECT id FROM public.parcels WHERE owner_id = (SELECT auth.uid()))) OR public.has_role((SELECT auth.uid()), 'tecnico') OR public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS "evidences owner read" ON storage.objects;
CREATE POLICY "evidences owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'evidences' AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text OR public.has_role((SELECT auth.uid()), 'tecnico') OR public.has_role((SELECT auth.uid()), 'admin')));

DROP POLICY IF EXISTS "evidences owner insert" ON storage.objects;
CREATE POLICY "evidences owner insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'evidences' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "evidences owner delete" ON storage.objects;
CREATE POLICY "evidences owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'evidences' AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text OR public.has_role((SELECT auth.uid()), 'admin')));

-- Sentinel credentials are read only by the SSR function, never by the browser.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_audit') THEN
    REVOKE EXECUTE ON FUNCTION public.log_audit() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.log_audit() FROM anon;
    REVOKE EXECUTE ON FUNCTION public.log_audit() FROM authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'apply_inventory_movement') THEN
    REVOKE EXECUTE ON FUNCTION public.apply_inventory_movement(uuid, text, numeric, text, numeric) FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.apply_inventory_movement(uuid, text, numeric, text, numeric) FROM anon;
    GRANT EXECUTE ON FUNCTION public.apply_inventory_movement(uuid, text, numeric, text, numeric) TO authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role') THEN
    REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
    GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
  END IF;
END $$;
