-- Notificaciones manuales: sólo técnico/admin, con autorización de destinatario en servidor.
ALTER TABLE public.alert_settings
  ADD COLUMN IF NOT EXISTS stock_alert_threshold numeric NOT NULL DEFAULT 0
  CHECK (stock_alert_threshold >= 0);

CREATE OR REPLACE FUNCTION public.create_manual_alert(
  p_recipient_id uuid,
  p_kind public.alert_kind,
  p_title text,
  p_body text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sender_id uuid := (SELECT auth.uid()); v_alert_id uuid;
BEGIN
  IF v_sender_id IS NULL THEN RAISE EXCEPTION 'Autenticación requerida'; END IF;
  IF btrim(coalesce(p_title, '')) = '' THEN RAISE EXCEPTION 'El título es obligatorio'; END IF;

  IF public.has_role(v_sender_id, 'tecnico'::public.app_role) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.technician_farmer_assignments a
      JOIN public.user_roles r ON r.user_id = a.farmer_id AND r.role = 'agricultor'::public.app_role
      WHERE a.technician_id = v_sender_id AND a.farmer_id = p_recipient_id
    ) THEN RAISE EXCEPTION 'Sólo puede notificar a agricultores asignados'; END IF;
  ELSIF public.has_role(v_sender_id, 'admin'::public.app_role) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = p_recipient_id AND r.role IN ('agricultor'::public.app_role, 'tecnico'::public.app_role)
    ) THEN RAISE EXCEPTION 'El destinatario debe ser técnico o agricultor'; END IF;
  ELSE
    RAISE EXCEPTION 'No tiene permisos para crear notificaciones manuales';
  END IF;

  INSERT INTO public.alerts (user_id, kind, title, body, scheduled_at, origin, sender_id)
  VALUES (p_recipient_id, p_kind, btrim(p_title), nullif(btrim(p_body), ''), now(), 'MANUAL', v_sender_id)
  RETURNING id INTO v_alert_id;
  RETURN v_alert_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_manual_alert_recipients()
RETURNS TABLE (id uuid, full_name text, role public.app_role)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT p.id, p.full_name, r.role
  FROM public.profiles p JOIN public.user_roles r ON r.user_id = p.id
  WHERE (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    AND r.role IN ('agricultor'::public.app_role, 'tecnico'::public.app_role)
  ) OR (
    public.has_role((SELECT auth.uid()), 'tecnico'::public.app_role)
    AND r.role = 'agricultor'::public.app_role
    AND EXISTS (SELECT 1 FROM public.technician_farmer_assignments a WHERE a.technician_id = (SELECT auth.uid()) AND a.farmer_id = p.id)
  )
  ORDER BY full_name;
$$;

-- El cliente no puede insertar directamente ni falsificar origen/emisor.
DROP POLICY IF EXISTS "alerts manual insert" ON public.alerts;
CREATE POLICY "alerts no direct insert" ON public.alerts FOR INSERT TO authenticated WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.set_alert_provenance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.origin = 'AUTOMATICA' THEN
    NEW.sender_id := NULL;
  ELSIF NEW.origin = 'MANUAL' THEN
    IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Las notificaciones manuales requieren emisor'; END IF;
    NEW.sender_id := (SELECT auth.uid());
  ELSE
    RAISE EXCEPTION 'Origen de notificación inválido';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_automatic_alerts()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_days integer; v_stock_enabled boolean; v_stock_threshold numeric;
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL AND NOT public.has_role((SELECT auth.uid()), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo administradores pueden generar alertas';
  END IF;
  SELECT planting_reminder_days, stock_alerts_enabled, stock_alert_threshold
    INTO v_days, v_stock_enabled, v_stock_threshold FROM public.alert_settings WHERE id;
  INSERT INTO public.alerts (user_id, crop_id, kind, title, body, scheduled_at, origin)
  SELECT p.owner_id, c.id, 'RIEGO'::public.alert_kind, 'Confirmar inicio de siembra',
         'La fecha de siembra de este cultivo ha llegado. Confirma el inicio para registrar la operación.', now(), 'AUTOMATICA'
  FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id
  WHERE c.status = 'PLANEADO' AND c.planting_date BETWEEN CURRENT_DATE AND CURRENT_DATE + v_days
    AND c.planting_confirmed_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.alerts a WHERE a.crop_id = c.id AND a.origin = 'AUTOMATICA' AND a.title = 'Confirmar inicio de siembra' AND a.created_at::date = CURRENT_DATE);
  IF v_stock_enabled THEN
    INSERT INTO public.alerts (user_id, kind, title, body, scheduled_at, origin)
    SELECT i.owner_id, 'STOCK'::public.alert_kind, 'Stock bajo: ' || i.name,
           'Disponibles: ' || i.stock_qty || ' ' || i.unit || '. Umbral aplicado: ' || greatest(i.min_stock, v_stock_threshold) || '.', now(), 'AUTOMATICA'
    FROM public.inventory_items i WHERE i.stock_qty <= greatest(i.min_stock, v_stock_threshold)
      AND NOT EXISTS (SELECT 1 FROM public.alerts a WHERE a.user_id = i.owner_id AND a.origin = 'AUTOMATICA' AND a.kind = 'STOCK' AND a.title = 'Stock bajo: ' || i.name AND a.created_at::date = CURRENT_DATE);
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_manual_alert(uuid, public.alert_kind, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_manual_alert(uuid, public.alert_kind, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.list_manual_alert_recipients() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_manual_alert_recipients() TO authenticated;
