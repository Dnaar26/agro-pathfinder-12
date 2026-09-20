-- Create the private evidence bucket in every environment, not only local Docker.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('evidences', 'evidences', false, 10485760)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit;

-- An activity must be recorded by a user who can access its crop.
DROP POLICY IF EXISTS "activities insert" ON public.activities;
CREATE POLICY "activities insert" ON public.activities FOR INSERT TO authenticated
WITH CHECK (
  responsible_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.crops c
    JOIN public.parcels p ON p.id = c.parcel_id
    WHERE c.id = crop_id
      AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'tecnico') OR public.has_role(auth.uid(), 'admin'))
  )
);

-- Apply inventory movements atomically and only to items the caller may manage.
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
DECLARE
  v_delta NUMERIC;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor que cero';
  END IF;

  IF p_kind = 'ENTRADA' THEN
    v_delta := p_qty;
  ELSIF p_kind = 'SALIDA' THEN
    v_delta := -p_qty;
  ELSIF p_kind = 'AJUSTE' THEN
    v_delta := 0;
  ELSE
    RAISE EXCEPTION 'Tipo de movimiento inválido';
  END IF;

  UPDATE public.inventory_items
  SET stock_qty = stock_qty + v_delta,
      updated_at = now()
  WHERE id = p_item_id
    AND (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    AND stock_qty + v_delta >= 0;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insumo no encontrado, sin permiso o stock insuficiente';
  END IF;

  INSERT INTO public.inventory_movements (item_id, kind, qty, notes)
  VALUES (p_item_id, p_kind::public.inventory_movement_kind, p_qty, p_notes);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_inventory_movement(UUID, TEXT, NUMERIC, TEXT, NUMERIC) TO authenticated;
