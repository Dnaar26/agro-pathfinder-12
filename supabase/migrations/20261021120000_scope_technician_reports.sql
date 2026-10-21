-- Keep technician reporting limited to explicitly assigned farmers.
-- Farmers retain full access to their own records; administrators retain global access.

-- Remove older permissive policies before adding the assignment-aware read rules.
DROP POLICY IF EXISTS "profile staff update" ON public.profiles;

DROP POLICY IF EXISTS "parcels select own or staff" ON public.parcels;
DROP POLICY IF EXISTS "parcels owner read" ON public.parcels;
CREATE POLICY "parcels owner read" ON public.parcels
  FOR SELECT TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR (
      public.has_role((SELECT auth.uid()), 'tecnico'::public.app_role)
      AND public.is_assigned_technician(owner_id)
    )
  );

DROP POLICY IF EXISTS "inventory select own or staff" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory owner read" ON public.inventory_items;
CREATE POLICY "inventory owner read" ON public.inventory_items
  FOR SELECT TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR (
      public.has_role((SELECT auth.uid()), 'tecnico'::public.app_role)
      AND public.is_assigned_technician(owner_id)
    )
  );

DROP POLICY IF EXISTS "movements owner" ON public.inventory_movements;
DROP POLICY IF EXISTS "movements owner read" ON public.inventory_movements;
CREATE POLICY "movements owner read" ON public.inventory_movements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.inventory_items i
      WHERE i.id = item_id
        AND (
          i.owner_id = (SELECT auth.uid())
          OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
          OR (
            public.has_role((SELECT auth.uid()), 'tecnico'::public.app_role)
            AND public.is_assigned_technician(i.owner_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS "batches via crop" ON public.batches;
CREATE POLICY "batches scoped read" ON public.batches
  FOR SELECT TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR public.can_access_crop(crop_id)
  );
CREATE POLICY "batches owner admin write" ON public.batches
  FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role) OR EXISTS (
    SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id
    WHERE c.id = crop_id AND p.owner_id = (SELECT auth.uid())
  ))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role) OR EXISTS (
    SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id
    WHERE c.id = crop_id AND p.owner_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "ndvi via parcel" ON public.ndvi_cache;
CREATE POLICY "ndvi scoped read" ON public.ndvi_cache
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.parcels p
    WHERE p.id = parcel_id
      AND (
        p.owner_id = (SELECT auth.uid())
        OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        OR (
          public.has_role((SELECT auth.uid()), 'tecnico'::public.app_role)
          AND public.is_assigned_technician(p.owner_id)
        )
      )
  ));
CREATE POLICY "ndvi owner admin write" ON public.ndvi_cache
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.parcels p
    WHERE p.id = parcel_id
      AND (p.owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.parcels p
    WHERE p.id = parcel_id
      AND (p.owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  ));

DROP POLICY IF EXISTS "weather via parcel" ON public.weather_cache;
CREATE POLICY "weather scoped read" ON public.weather_cache
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.parcels p
    WHERE p.id = parcel_id
      AND (
        p.owner_id = (SELECT auth.uid())
        OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        OR (
          public.has_role((SELECT auth.uid()), 'tecnico'::public.app_role)
          AND public.is_assigned_technician(p.owner_id)
        )
      )
  ));
CREATE POLICY "weather owner admin write" ON public.weather_cache
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.parcels p
    WHERE p.id = parcel_id
      AND (p.owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.parcels p
    WHERE p.id = parcel_id
      AND (p.owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  ));

DROP POLICY IF EXISTS "evidences owner read" ON storage.objects;
CREATE POLICY "evidences owner read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'evidences'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
      OR CASE
        WHEN (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN public.can_access_crop(((storage.foldername(name))[2])::uuid)
        ELSE false
      END
    )
  );

-- Assigned technicians can log visits and pest observations, but cannot edit or delete farmer records.
DROP POLICY IF EXISTS "activities assigned technician insert" ON public.activities;
CREATE POLICY "activities assigned technician insert" ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (
    responsible_id = (SELECT auth.uid())
    AND public.has_role((SELECT auth.uid()), 'tecnico'::public.app_role)
    AND public.can_access_crop(crop_id)
  );

DROP POLICY IF EXISTS "pest incidents assigned technician insert" ON public.pest_incidents;
CREATE POLICY "pest incidents assigned technician insert" ON public.pest_incidents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'tecnico'::public.app_role)
    AND public.can_access_crop(crop_id)
  );

DROP POLICY IF EXISTS "costs via crop" ON public.crop_costs;
CREATE POLICY "crop costs scoped read" ON public.crop_costs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.crops c
      JOIN public.parcels p ON p.id = c.parcel_id
      WHERE c.id = crop_id
        AND (
          p.owner_id = (SELECT auth.uid())
          OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
          OR (
            public.has_role((SELECT auth.uid()), 'tecnico'::public.app_role)
            AND public.is_assigned_technician(p.owner_id)
          )
        )
    )
  );
CREATE POLICY "crop costs owner admin write" ON public.crop_costs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.crops c
      JOIN public.parcels p ON p.id = c.parcel_id
      WHERE c.id = crop_id
        AND (
          p.owner_id = (SELECT auth.uid())
          OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.crops c
      JOIN public.parcels p ON p.id = c.parcel_id
      WHERE c.id = crop_id
        AND (
          p.owner_id = (SELECT auth.uid())
          OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        )
    )
  );

DROP POLICY IF EXISTS "harvests via crop" ON public.crop_harvests;
CREATE POLICY "crop harvests scoped read" ON public.crop_harvests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.crops c
      JOIN public.parcels p ON p.id = c.parcel_id
      WHERE c.id = crop_id
        AND (
          p.owner_id = (SELECT auth.uid())
          OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
          OR (
            public.has_role((SELECT auth.uid()), 'tecnico'::public.app_role)
            AND public.is_assigned_technician(p.owner_id)
          )
        )
    )
  );
CREATE POLICY "crop harvests owner admin write" ON public.crop_harvests
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.crops c
      JOIN public.parcels p ON p.id = c.parcel_id
      WHERE c.id = crop_id
        AND (
          p.owner_id = (SELECT auth.uid())
          OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.crops c
      JOIN public.parcels p ON p.id = c.parcel_id
      WHERE c.id = crop_id
        AND (
          p.owner_id = (SELECT auth.uid())
          OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        )
    )
  );

DROP POLICY IF EXISTS "pest_incidents staff" ON public.pest_incidents;
DROP POLICY IF EXISTS "Users own their pest incidents" ON public.pest_incidents;
CREATE POLICY "pest incidents scoped read" ON public.pest_incidents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.crops c
      JOIN public.parcels p ON p.id = c.parcel_id
      WHERE c.id = crop_id
        AND (
          p.owner_id = (SELECT auth.uid())
          OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
          OR (
            public.has_role((SELECT auth.uid()), 'tecnico'::public.app_role)
            AND public.is_assigned_technician(p.owner_id)
          )
        )
    )
  );
CREATE POLICY "pest incidents owner admin write" ON public.pest_incidents
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.crops c
      JOIN public.parcels p ON p.id = c.parcel_id
      WHERE c.id = crop_id
        AND (
          p.owner_id = (SELECT auth.uid())
          OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.crops c
      JOIN public.parcels p ON p.id = c.parcel_id
      WHERE c.id = crop_id
        AND (
          p.owner_id = (SELECT auth.uid())
          OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        )
    )
  );
