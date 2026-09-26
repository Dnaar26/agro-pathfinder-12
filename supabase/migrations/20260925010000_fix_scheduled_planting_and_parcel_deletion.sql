-- Un cultivo programado no se inicia por el cron: requiere confirmación explícita.
CREATE OR REPLACE FUNCTION public.generate_automatic_alerts()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_days integer; v_stock_enabled boolean;
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL AND NOT public.has_role((SELECT auth.uid()), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo administradores pueden generar alertas';
  END IF;

  SELECT planting_reminder_days, stock_alerts_enabled
    INTO v_days, v_stock_enabled
    FROM public.alert_settings WHERE id;

  -- No cambia PLANEADO a SEMBRADO: la acción Confirmar inicio es la única transición.
  INSERT INTO public.alerts (user_id, crop_id, kind, title, body, scheduled_at, origin)
  SELECT p.owner_id, c.id, 'RIEGO'::public.alert_kind, 'Confirmar inicio de siembra',
         'La fecha de siembra de este cultivo ha llegado. Confirma el inicio para registrar la operación.', now(), 'AUTOMATICA'
    FROM public.crops c
    JOIN public.parcels p ON p.id = c.parcel_id
   WHERE c.status = 'PLANEADO'
     AND c.planting_date BETWEEN CURRENT_DATE AND CURRENT_DATE + v_days
     AND c.planting_confirmed_at IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.alerts a
        WHERE a.crop_id = c.id
          AND a.origin = 'AUTOMATICA'
          AND a.title = 'Confirmar inicio de siembra'
          AND a.created_at::date = CURRENT_DATE
     );

  IF v_stock_enabled THEN
    INSERT INTO public.alerts (user_id, kind, title, body, scheduled_at, origin)
    SELECT i.owner_id, 'STOCK'::public.alert_kind, 'Stock mínimo alcanzado: ' || i.name,
           'Disponibles: ' || i.stock_qty || ' ' || i.unit || '. Mínimo configurado: ' || i.min_stock || '.', now(), 'AUTOMATICA'
      FROM public.inventory_items i
     WHERE i.stock_qty <= i.min_stock
       AND NOT EXISTS (
         SELECT 1 FROM public.alerts a
          WHERE a.user_id = i.owner_id AND a.origin = 'AUTOMATICA'
            AND a.kind = 'STOCK' AND a.title = 'Stock mínimo alcanzado: ' || i.name
            AND a.created_at::date = CURRENT_DATE
       );
  END IF;
END;
$$;

-- La RPC confirma que la fila fue eliminada; un éxito nulo ya no se interpreta como baja exitosa.
DROP FUNCTION IF EXISTS public.delete_parcel_cascade(uuid);
CREATE FUNCTION public.delete_parcel_cascade(p_parcel_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_deleted_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Autenticación requerida'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.parcels
     WHERE id = p_parcel_id
       AND (owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  ) THEN
    RAISE EXCEPTION 'No tiene permisos para eliminar esta parcela';
  END IF;

  DELETE FROM public.parcels WHERE id = p_parcel_id RETURNING id INTO v_deleted_id;
  IF v_deleted_id IS NULL THEN RAISE EXCEPTION 'Parcela no encontrada'; END IF;
  RETURN v_deleted_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.delete_parcel_cascade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_parcel_cascade(uuid) TO authenticated;
