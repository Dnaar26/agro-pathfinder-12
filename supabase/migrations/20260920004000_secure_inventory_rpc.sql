-- Secure the authenticated inventory RPC without changing existing data.
CREATE OR REPLACE FUNCTION public.apply_inventory_movement(
  p_item_id UUID,
  p_kind TEXT,
  p_qty NUMERIC,
  p_notes TEXT DEFAULT NULL,
  p_delta NUMERIC DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  effective_delta NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;

  IF p_kind NOT IN ('ENTRADA', 'SALIDA', 'AJUSTE') THEN
    RAISE EXCEPTION 'Invalid movement kind';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.inventory_items
    WHERE id = p_item_id
      AND (owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'))
  ) THEN
    RAISE EXCEPTION 'Inventory item not accessible';
  END IF;

  effective_delta := CASE p_kind
    WHEN 'ENTRADA' THEN p_qty
    WHEN 'SALIDA' THEN -p_qty
    ELSE p_qty
  END;

  IF p_delta IS NOT NULL AND p_delta <> effective_delta THEN
    RAISE EXCEPTION 'Invalid inventory delta';
  END IF;

  INSERT INTO public.inventory_movements (item_id, kind, qty, notes)
  VALUES (p_item_id, p_kind::public.inventory_movement_kind, p_qty, p_notes);

  UPDATE public.inventory_items
  SET stock_qty = stock_qty + effective_delta,
      updated_at = now()
  WHERE id = p_item_id
    AND stock_qty + effective_delta >= 0;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient stock';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_inventory_movement(uuid, text, numeric, text, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_inventory_movement(uuid, text, numeric, text, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_inventory_movement(uuid, text, numeric, text, numeric) TO authenticated;
