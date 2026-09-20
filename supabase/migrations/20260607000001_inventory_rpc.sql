-- Atomic inventory movement
CREATE OR REPLACE FUNCTION public.apply_inventory_movement(
  p_item_id UUID,
  p_kind TEXT,
  p_qty NUMERIC,
  p_notes TEXT DEFAULT NULL,
  p_delta NUMERIC DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO inventory_movements (item_id, kind, qty, notes)
  VALUES (p_item_id, p_kind::inventory_movement_kind, p_qty, p_notes);

  UPDATE inventory_items
  SET stock_qty = GREATEST(0, stock_qty + p_delta),
      updated_at = now()
  WHERE id = p_item_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_inventory_movement TO authenticated;
