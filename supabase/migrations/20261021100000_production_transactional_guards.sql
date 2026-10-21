-- Integridad de calendario, inventario y ciclo de cultivo para producción.

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS calendar_event_id uuid
    REFERENCES public.calendar_events(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_movements_calendar_event_uidx
  ON public.inventory_movements (calendar_event_id)
  WHERE calendar_event_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.prevent_direct_calendar_inventory_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.calendar_event_id IS NOT NULL
     AND current_setting('app.calendar_inventory_mutation', true) IS DISTINCT FROM 'rpc' THEN
    RAISE EXCEPTION 'Los movimientos vinculados a eventos deben crearse mediante la operación transaccional';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_movements_protect_calendar_link ON public.inventory_movements;
CREATE TRIGGER inventory_movements_protect_calendar_link
BEFORE INSERT OR UPDATE OF calendar_event_id ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_calendar_inventory_link();

CREATE OR REPLACE FUNCTION public.can_access_crop(p_crop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.crops c
    JOIN public.parcels p ON p.id = c.parcel_id
    WHERE c.id = p_crop_id
      AND (
        p.owner_id = (SELECT auth.uid())
        OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        OR (
          public.has_role((SELECT auth.uid()), 'tecnico'::public.app_role)
          AND public.is_assigned_technician(p.owner_id)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_calendar_event(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.calendar_events e
    WHERE e.id = p_event_id
      AND (
        e.user_id = (SELECT auth.uid())
        OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        OR (e.crop_id IS NOT NULL AND public.can_access_crop(e.crop_id))
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_crop(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_crop(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_access_calendar_event(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_calendar_event(uuid) TO authenticated;

-- Reemplaza políticas anteriores que daban acceso global a cualquier técnico.
DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calendar_events'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.calendar_events', policy_row.policyname);
  END LOOP;
END $$;

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar events scoped read" ON public.calendar_events
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR (crop_id IS NOT NULL AND public.can_access_crop(crop_id))
  );

-- Las escrituras pasan por RPCs transaccionales. No se habilitan INSERT/UPDATE/DELETE directos.

CREATE OR REPLACE FUNCTION public.create_calendar_event_with_inventory(
  p_title text,
  p_starts_at timestamptz,
  p_description text DEFAULT NULL,
  p_crop_id uuid DEFAULT NULL,
  p_item_id uuid DEFAULT NULL,
  p_qty numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_event_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Autenticación requerida'; END IF;
  IF length(trim(coalesce(p_title, ''))) < 2 OR length(p_title) > 150 THEN
    RAISE EXCEPTION 'El título del evento no es válido';
  END IF;
  IF p_starts_at IS NULL OR p_starts_at < now() - interval '2 minutes' THEN
    RAISE EXCEPTION 'No se pueden programar eventos en fechas u horas pasadas';
  END IF;
  IF p_description IS NOT NULL AND length(p_description) > 500 THEN
    RAISE EXCEPTION 'La descripción del evento es demasiado larga';
  END IF;
  IF (p_item_id IS NULL) <> (p_qty IS NULL) THEN
    RAISE EXCEPTION 'El insumo y la cantidad deben enviarse juntos';
  END IF;
  IF p_qty IS NOT NULL AND p_qty::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'La cantidad del insumo no es válida';
  END IF;
  IF p_crop_id IS NOT NULL AND NOT public.can_access_crop(p_crop_id) THEN
    RAISE EXCEPTION 'El cultivo no está disponible para este usuario';
  END IF;
  IF p_item_id IS NOT NULL AND (p_qty <= 0 OR NOT EXISTS (
    SELECT 1 FROM public.inventory_items i
    WHERE i.id = p_item_id
      AND (i.owner_id = v_user_id OR public.has_role(v_user_id, 'admin'::public.app_role))
  )) THEN
    RAISE EXCEPTION 'El insumo no está disponible o la cantidad no es válida';
  END IF;

  INSERT INTO public.calendar_events (user_id, title, description, crop_id, starts_at)
  VALUES (v_user_id, trim(p_title), NULLIF(trim(p_description), ''), p_crop_id, p_starts_at)
  RETURNING id INTO v_event_id;

  IF p_item_id IS NOT NULL THEN
    UPDATE public.inventory_items
    SET stock_qty = stock_qty - p_qty, updated_at = now()
    WHERE id = p_item_id AND stock_qty >= p_qty;
    IF NOT FOUND THEN RAISE EXCEPTION 'Stock insuficiente'; END IF;

    PERFORM set_config('app.calendar_inventory_mutation', 'rpc', true);
    INSERT INTO public.inventory_movements (item_id, kind, qty, notes, calendar_event_id)
    VALUES (p_item_id, 'SALIDA'::public.inventory_movement_kind, p_qty,
      'Uso en evento: ' || trim(p_title), v_event_id);
  END IF;

  RETURN v_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_calendar_event_with_inventory(
  p_event_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_description text DEFAULT NULL,
  p_crop_id uuid DEFAULT NULL,
  p_item_id uuid DEFAULT NULL,
  p_qty numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.calendar_events%ROWTYPE;
  v_old_movement public.inventory_movements%ROWTYPE;
  v_has_old_movement boolean := false;
  v_user_id uuid := (SELECT auth.uid());
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Autenticación requerida'; END IF;
  IF length(trim(coalesce(p_title, ''))) < 2 OR length(p_title) > 150 THEN
    RAISE EXCEPTION 'El título del evento no es válido';
  END IF;
  IF p_starts_at IS NULL THEN RAISE EXCEPTION 'La fecha del evento es obligatoria'; END IF;
  IF p_description IS NOT NULL AND length(p_description) > 500 THEN
    RAISE EXCEPTION 'La descripción del evento es demasiado larga';
  END IF;
  IF (p_item_id IS NULL) <> (p_qty IS NULL) THEN
    RAISE EXCEPTION 'El insumo y la cantidad deben enviarse juntos';
  END IF;
  IF p_qty IS NOT NULL AND p_qty::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'La cantidad del insumo no es válida';
  END IF;
  IF p_crop_id IS NOT NULL AND NOT public.can_access_crop(p_crop_id) THEN
    RAISE EXCEPTION 'El cultivo no está disponible para este usuario';
  END IF;
  IF p_item_id IS NOT NULL AND (p_qty IS NULL OR p_qty <= 0) THEN
    RAISE EXCEPTION 'La cantidad del insumo no es válida';
  END IF;
  IF p_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.inventory_items i
    WHERE i.id = p_item_id
      AND (i.owner_id = v_user_id OR public.has_role(v_user_id, 'admin'::public.app_role))
  ) THEN
    RAISE EXCEPTION 'El insumo no está disponible para este usuario';
  END IF;

  SELECT * INTO v_event
  FROM public.calendar_events
  WHERE id = p_event_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Evento no encontrado'; END IF;
  IF NOT (
    v_event.user_id = v_user_id
    OR public.has_role(v_user_id, 'admin'::public.app_role)
    OR (v_event.crop_id IS NOT NULL AND public.can_access_crop(v_event.crop_id))
  ) THEN
    RAISE EXCEPTION 'No tiene permisos para modificar este evento';
  END IF;
  IF p_starts_at < now() - interval '2 minutes'
     AND p_starts_at IS DISTINCT FROM v_event.starts_at THEN
    RAISE EXCEPTION 'No se pueden reprogramar eventos en fechas u horas pasadas';
  END IF;

  SELECT * INTO v_old_movement
  FROM public.inventory_movements
  WHERE calendar_event_id = p_event_id
  FOR UPDATE;
  v_has_old_movement := FOUND;

  -- Sin insumo en la edición significa conservar el consumo existente.
  IF p_item_id IS NOT NULL AND v_has_old_movement THEN
    IF v_old_movement.kind <> 'SALIDA'::public.inventory_movement_kind THEN
      RAISE EXCEPTION 'El movimiento asociado no puede sustituirse automáticamente';
    END IF;
    UPDATE public.inventory_items
    SET stock_qty = stock_qty + v_old_movement.qty, updated_at = now()
    WHERE id = v_old_movement.item_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo restaurar el inventario anterior'; END IF;
    DELETE FROM public.inventory_movements WHERE id = v_old_movement.id;
    v_has_old_movement := false;
  END IF;

  UPDATE public.calendar_events
  SET title = trim(p_title),
      description = NULLIF(trim(p_description), ''),
      crop_id = p_crop_id,
      starts_at = p_starts_at
  WHERE id = p_event_id;

  IF p_item_id IS NOT NULL AND NOT v_has_old_movement THEN
    UPDATE public.inventory_items
    SET stock_qty = stock_qty - p_qty, updated_at = now()
    WHERE id = p_item_id AND stock_qty >= p_qty;
    IF NOT FOUND THEN RAISE EXCEPTION 'Stock insuficiente'; END IF;
    PERFORM set_config('app.calendar_inventory_mutation', 'rpc', true);
    INSERT INTO public.inventory_movements (item_id, kind, qty, notes, calendar_event_id)
    VALUES (p_item_id, 'SALIDA'::public.inventory_movement_kind, p_qty,
      'Uso en evento: ' || trim(p_title), p_event_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_calendar_event_with_inventory(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.calendar_events%ROWTYPE;
  v_movement public.inventory_movements%ROWTYPE;
  v_user_id uuid := (SELECT auth.uid());
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Autenticación requerida'; END IF;
  SELECT * INTO v_event FROM public.calendar_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Evento no encontrado'; END IF;
  IF NOT (
    v_event.user_id = v_user_id
    OR public.has_role(v_user_id, 'admin'::public.app_role)
    OR (v_event.crop_id IS NOT NULL AND public.can_access_crop(v_event.crop_id))
  ) THEN
    RAISE EXCEPTION 'No tiene permisos para eliminar este evento';
  END IF;

  SELECT * INTO v_movement
  FROM public.inventory_movements
  WHERE calendar_event_id = p_event_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_movement.kind <> 'SALIDA'::public.inventory_movement_kind THEN
      RAISE EXCEPTION 'El movimiento asociado no puede revertirse automáticamente';
    END IF;
    UPDATE public.inventory_items
    SET stock_qty = stock_qty + v_movement.qty, updated_at = now()
    WHERE id = v_movement.item_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo restaurar el inventario'; END IF;
    DELETE FROM public.inventory_movements WHERE id = v_movement.id;
  END IF;

  DELETE FROM public.calendar_events WHERE id = p_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_calendar_event_done(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_access_calendar_event(p_event_id) THEN
    RAISE EXCEPTION 'No tiene permisos para modificar este evento';
  END IF;
  UPDATE public.calendar_events SET done = true WHERE id = p_event_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_calendar_event_with_inventory(text, timestamptz, text, uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_calendar_event_with_inventory(text, timestamptz, text, uuid, uuid, numeric) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_calendar_event_with_inventory(uuid, text, timestamptz, text, uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_calendar_event_with_inventory(uuid, text, timestamptz, text, uuid, uuid, numeric) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_calendar_event_with_inventory(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_calendar_event_with_inventory(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_calendar_event_done(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_calendar_event_done(uuid) TO authenticated;

-- El inicio de siembra debe ser explícito; cambiar la fecha reinicia la confirmación.
CREATE OR REPLACE FUNCTION public.set_crop_planting_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.planting_date IS DISTINCT FROM OLD.planting_date THEN
    NEW.status := 'PLANEADO'::public.crop_status;
    NEW.planting_confirmed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_automatic_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days integer;
  v_stock_enabled boolean;
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL
     AND NOT public.has_role((SELECT auth.uid()), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo administradores pueden generar alertas';
  END IF;
  SELECT planting_reminder_days, stock_alerts_enabled
  INTO v_days, v_stock_enabled
  FROM public.alert_settings WHERE id;

  INSERT INTO public.alerts (user_id, crop_id, kind, title, body, scheduled_at, origin)
  SELECT p.owner_id, c.id, 'RIEGO'::public.alert_kind, 'Confirmar inicio de siembra',
         'La fecha de siembra de este cultivo ha llegado. Confirma el inicio para registrar la operación.', now(), 'AUTOMATICA'
  FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id
  WHERE c.planting_date BETWEEN CURRENT_DATE AND CURRENT_DATE + v_days
    AND c.planting_confirmed_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.alerts a
      WHERE a.crop_id = c.id AND a.origin = 'AUTOMATICA'
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
          AND a.kind = 'STOCK'
          AND a.title = 'Stock mínimo alcanzado: ' || i.name
          AND a.created_at::date = CURRENT_DATE
      );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_crop_planting(p_crop_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_crop public.crops%ROWTYPE;
BEGIN
  IF NOT public.can_access_crop(p_crop_id) THEN RAISE EXCEPTION 'Cultivo no disponible'; END IF;
  SELECT * INTO v_crop FROM public.crops WHERE id = p_crop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cultivo no encontrado'; END IF;
  IF v_crop.planting_confirmed_at IS NOT NULL THEN RETURN; END IF;
  IF v_crop.planting_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'La fecha de siembra todavía no ha llegado';
  END IF;
  PERFORM set_config('app.crop_status_mutation', 'rpc', true);
  UPDATE public.crops
  SET status = 'SEMBRADO'::public.crop_status, planting_confirmed_at = now()
  WHERE id = p_crop_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_crop_status(
  p_crop_id uuid,
  p_status public.crop_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current public.crop_status;
  v_confirmed_at timestamptz;
BEGIN
  IF NOT public.can_access_crop(p_crop_id) THEN RAISE EXCEPTION 'Cultivo no disponible'; END IF;
  SELECT status, planting_confirmed_at INTO v_current, v_confirmed_at
  FROM public.crops WHERE id = p_crop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cultivo no encontrado'; END IF;
  IF p_status = v_current THEN RETURN; END IF;
  IF p_status = 'PLANEADO'::public.crop_status THEN
    RAISE EXCEPTION 'El cultivo sólo vuelve a planificado al cambiar la fecha de siembra';
  END IF;
  IF p_status <> 'SEMBRADO'::public.crop_status AND v_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Confirma primero el inicio de siembra';
  END IF;
  IF NOT (
    (v_current = 'PLANEADO'::public.crop_status AND p_status = 'SEMBRADO'::public.crop_status)
    OR (v_current = 'SEMBRADO'::public.crop_status AND p_status IN ('CRECIMIENTO', 'MANTENIMIENTO', 'COSECHA'))
    OR (v_current = 'CRECIMIENTO'::public.crop_status AND p_status IN ('MANTENIMIENTO', 'COSECHA'))
    OR (v_current = 'MANTENIMIENTO'::public.crop_status AND p_status = 'COSECHA'::public.crop_status)
    OR (v_current = 'COSECHA'::public.crop_status AND p_status IN ('POSTCOSECHA', 'FINALIZADO'))
    OR (v_current = 'POSTCOSECHA'::public.crop_status AND p_status = 'FINALIZADO'::public.crop_status)
  ) THEN
    RAISE EXCEPTION 'Transición de estado no permitida';
  END IF;
  PERFORM set_config('app.crop_status_mutation', 'rpc', true);
  UPDATE public.crops SET status = p_status WHERE id = p_crop_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_crop_statuses(
  p_crop_ids uuid[],
  p_status public.crop_status
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_crop_id uuid;
  v_count integer := 0;
BEGIN
  IF p_crop_ids IS NULL OR cardinality(p_crop_ids) = 0 THEN RETURN 0; END IF;
  IF cardinality(p_crop_ids) > 100 THEN RAISE EXCEPTION 'No se pueden actualizar más de 100 cultivos a la vez'; END IF;
  FOREACH v_crop_id IN ARRAY p_crop_ids LOOP
    PERFORM public.transition_crop_status(v_crop_id, p_status);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_direct_crop_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND current_setting('app.crop_status_mutation', true) IS DISTINCT FROM 'rpc' THEN
    RAISE EXCEPTION 'Use una operación de transición de cultivo';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crops_prevent_direct_status_change ON public.crops;
CREATE TRIGGER crops_prevent_direct_status_change
BEFORE UPDATE OF status ON public.crops
FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_crop_status_change();

REVOKE EXECUTE ON FUNCTION public.confirm_crop_planting(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_crop_planting(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transition_crop_status(uuid, public.crop_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_crop_status(uuid, public.crop_status) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transition_crop_statuses(uuid[], public.crop_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_crop_statuses(uuid[], public.crop_status) TO authenticated;
