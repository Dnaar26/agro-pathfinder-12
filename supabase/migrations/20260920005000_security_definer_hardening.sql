-- Harden the two SECURITY DEFINER functions that are intentionally callable
-- by authenticated clients: RLS role checks and atomic inventory movements.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE _user_id = (SELECT auth.uid())
      AND user_id = _user_id
      AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.apply_inventory_movement(
  p_item_id uuid,
  p_kind text,
  p_qty numeric,
  p_notes text DEFAULT NULL,
  p_delta numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  effective_delta numeric;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_item_id IS NULL OR p_qty IS NULL OR p_qty <= 0
     OR p_qty::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Quantity must be a finite value greater than zero';
  END IF;

  IF p_kind IS NULL OR p_kind NOT IN ('ENTRADA', 'SALIDA', 'AJUSTE') THEN
    RAISE EXCEPTION 'Invalid movement kind';
  END IF;

  IF p_notes IS NOT NULL AND length(p_notes) > 2000 THEN
    RAISE EXCEPTION 'Movement notes are too long';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.inventory_items
    WHERE id = p_item_id
      AND (
        owner_id = (SELECT auth.uid())
        OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
      )
  ) THEN
    RAISE EXCEPTION 'Inventory item not accessible';
  END IF;

  effective_delta := CASE p_kind
    WHEN 'ENTRADA' THEN p_qty
    WHEN 'SALIDA' THEN -p_qty
    ELSE COALESCE(p_delta, p_qty)
  END;

  IF effective_delta IS NULL
     OR effective_delta::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Invalid inventory delta';
  END IF;

  IF p_delta IS NOT NULL AND p_kind <> 'AJUSTE' AND p_delta <> effective_delta THEN
    RAISE EXCEPTION 'Invalid inventory delta';
  END IF;

  INSERT INTO public.inventory_movements (item_id, kind, qty, notes)
  VALUES (p_item_id, p_kind::public.inventory_movement_kind, p_qty, p_notes);

  UPDATE public.inventory_items
  SET stock_qty = stock_qty + effective_delta,
      updated_at = pg_catalog.now()
  WHERE id = p_item_id
    AND stock_qty + effective_delta >= 0;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient stock';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.apply_inventory_movement(uuid, text, numeric, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_inventory_movement(uuid, text, numeric, text, numeric) TO authenticated;

-- Replace broad FOR ALL policies that allowed staff to mutate other owners'
-- parcels or inventory through direct PostgREST writes.
DROP POLICY IF EXISTS "parcels owner all" ON public.parcels;
DROP POLICY IF EXISTS "parcels select" ON public.parcels;
DROP POLICY IF EXISTS "parcels insert" ON public.parcels;
DROP POLICY IF EXISTS "parcels update" ON public.parcels;
DROP POLICY IF EXISTS "parcels delete" ON public.parcels;

CREATE POLICY "parcels select own or staff" ON public.parcels FOR SELECT TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'tecnico'::public.app_role)
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

CREATE POLICY "parcels insert own" ON public.parcels FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

CREATE POLICY "parcels update own or admin" ON public.parcels FOR UPDATE TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  )
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

CREATE POLICY "parcels delete admin" ON public.parcels FOR DELETE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS "inventory owner" ON public.inventory_items;
CREATE POLICY "inventory select own or staff" ON public.inventory_items FOR SELECT TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'tecnico'::public.app_role)
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

CREATE POLICY "inventory insert own" ON public.inventory_items FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

CREATE POLICY "inventory update own or admin" ON public.inventory_items FOR UPDATE TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  )
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

CREATE POLICY "inventory delete own or admin" ON public.inventory_items FOR DELETE TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );
