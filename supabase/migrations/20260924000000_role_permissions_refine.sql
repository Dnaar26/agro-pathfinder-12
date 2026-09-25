-- Migration: Refine role permissions
-- Técnico: solo lectura en inventory_items e inventory_movements
-- Técnico: no puede modificar parcelas (solo lectura)
-- Agricultor: acceso a reportes de sus propios datos

-- 1. inventory_items: técnico solo SELECT
DROP POLICY IF EXISTS "inventory owner" ON public.inventory_items;
CREATE POLICY "inventory owner read" ON public.inventory_items FOR SELECT TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'tecnico')
    OR public.has_role((SELECT auth.uid()), 'admin')
  );
CREATE POLICY "inventory owner write" ON public.inventory_items FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin')
  );
CREATE POLICY "inventory owner update" ON public.inventory_items FOR UPDATE TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin')
  )
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin')
  );
CREATE POLICY "inventory owner delete" ON public.inventory_items FOR DELETE TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin')
  );

-- 2. inventory_movements: técnico solo SELECT
DROP POLICY IF EXISTS "movements owner" ON public.inventory_movements;
CREATE POLICY "movements owner read" ON public.inventory_movements FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.inventory_items i
      WHERE i.id = item_id
        AND (
          i.owner_id = (SELECT auth.uid())
          OR public.has_role((SELECT auth.uid()), 'tecnico')
          OR public.has_role((SELECT auth.uid()), 'admin')
        )
    )
  );
CREATE POLICY "movements owner write" ON public.inventory_movements FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inventory_items i
      WHERE i.id = item_id
        AND (
          i.owner_id = (SELECT auth.uid())
          OR public.has_role((SELECT auth.uid()), 'admin')
        )
    )
  );

-- 3. parcelas: técnico solo SELECT (no puede INSERT/UPDATE/DELETE)
DROP POLICY IF EXISTS "parcels owner all" ON public.parcels;
CREATE POLICY "parcels owner read" ON public.parcels FOR SELECT TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'tecnico')
    OR public.has_role((SELECT auth.uid()), 'admin')
  );
CREATE POLICY "parcels owner write" ON public.parcels FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin')
  );
CREATE POLICY "parcels owner update" ON public.parcels FOR UPDATE TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin')
  )
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin')
  );
CREATE POLICY "parcels owner delete" ON public.parcels FOR DELETE TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin')
  );
