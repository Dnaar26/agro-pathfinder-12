-- Ciclo de siembra, notificaciones trazables, acceso técnico acotado y bajas atómicas.

ALTER TABLE public.crops
  ADD COLUMN IF NOT EXISTS planting_confirmed_at timestamptz;
ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS sender_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'AUTOMATICA'
    CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'SISTEMA'));

CREATE TABLE IF NOT EXISTS public.technician_farmer_assignments (
  technician_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  farmer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (technician_id, farmer_id),
  CHECK (technician_id <> farmer_id)
);

CREATE TABLE IF NOT EXISTS public.alert_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  planting_reminder_days integer NOT NULL DEFAULT 1 CHECK (planting_reminder_days BETWEEN 0 AND 30),
  stock_alerts_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
INSERT INTO public.alert_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_assigned_technician(p_farmer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.technician_farmer_assignments a
    WHERE a.technician_id = (SELECT auth.uid()) AND a.farmer_id = p_farmer_id
  );
$$;

CREATE OR REPLACE FUNCTION public.set_crop_planting_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- La fecha define el estado inicial; estados posteriores (crecimiento, cosecha, etc.) no se pisan.
  IF TG_OP = 'INSERT' OR (NEW.planting_date IS DISTINCT FROM OLD.planting_date
      AND NEW.status IN ('PLANEADO', 'SEMBRADO')) THEN
    NEW.status := CASE WHEN NEW.planting_date > CURRENT_DATE THEN 'PLANEADO'::public.crop_status
                       ELSE 'SEMBRADO'::public.crop_status END;
  END IF;
  -- La transición por fecha no sustituye la confirmación explícita del agricultor.
  -- planting_confirmed_at sólo se registra desde la acción «Confirmar inicio».
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS crops_set_planting_state ON public.crops;
CREATE TRIGGER crops_set_planting_state BEFORE INSERT OR UPDATE ON public.crops
FOR EACH ROW EXECUTE FUNCTION public.set_crop_planting_state();

CREATE OR REPLACE FUNCTION public.set_alert_provenance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.origin = 'MANUAL' THEN NEW.sender_id := (SELECT auth.uid()); END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS alerts_set_provenance ON public.alerts;
CREATE TRIGGER alerts_set_provenance BEFORE INSERT ON public.alerts
FOR EACH ROW EXECUTE FUNCTION public.set_alert_provenance();

-- El generador puede ejecutarse desde el panel administrativo o un cron. Es idempotente por día/tipo/cultivo.
CREATE OR REPLACE FUNCTION public.generate_automatic_alerts()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_days integer; v_stock_enabled boolean;
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL AND NOT public.has_role((SELECT auth.uid()), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo administradores pueden generar alertas';
  END IF;
  SELECT planting_reminder_days, stock_alerts_enabled INTO v_days, v_stock_enabled FROM public.alert_settings WHERE id;
  UPDATE public.crops SET status = 'SEMBRADO'
   WHERE status = 'PLANEADO' AND planting_date <= CURRENT_DATE;
  INSERT INTO public.alerts (user_id, crop_id, kind, title, body, scheduled_at, origin)
  SELECT p.owner_id, c.id, 'RIEGO'::public.alert_kind, 'Confirmar inicio de siembra',
         'La fecha de siembra de este cultivo ha llegado. Confirma el inicio para registrar la operación.', now(), 'AUTOMATICA'
  FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id
  WHERE c.planting_date BETWEEN CURRENT_DATE AND CURRENT_DATE + v_days
    AND c.planting_confirmed_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.alerts a WHERE a.crop_id = c.id AND a.origin = 'AUTOMATICA'
      AND a.title = 'Confirmar inicio de siembra' AND a.created_at::date = CURRENT_DATE);
  IF v_stock_enabled THEN
    INSERT INTO public.alerts (user_id, kind, title, body, scheduled_at, origin)
    SELECT i.owner_id, 'STOCK'::public.alert_kind, 'Stock mínimo alcanzado: ' || i.name,
           'Disponibles: ' || i.stock_qty || ' ' || i.unit || '. Mínimo configurado: ' || i.min_stock || '.', now(), 'AUTOMATICA'
    FROM public.inventory_items i WHERE i.stock_qty <= i.min_stock
      AND NOT EXISTS (SELECT 1 FROM public.alerts a WHERE a.user_id = i.owner_id AND a.origin = 'AUTOMATICA'
        AND a.kind = 'STOCK' AND a.title = 'Stock mínimo alcanzado: ' || i.name AND a.created_at::date = CURRENT_DATE);
  END IF;
END;
$$;

-- Todas las dependencias agrícolas se eliminan mediante las FK; se normalizan a CASCADE para evitar bajas parciales.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conrelid::regclass AS tbl, conname, pg_get_constraintdef(oid) AS def
           FROM pg_constraint WHERE contype = 'f' AND confrelid IN ('public.parcels'::regclass, 'public.crops'::regclass)
             AND confdeltype <> 'c'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s ON DELETE CASCADE', r.tbl, r.conname,
      regexp_replace(r.def, ' ON DELETE [A-Z ]+', '', 'g'));
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.delete_parcel_cascade(p_parcel_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Autenticación requerida'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.parcels WHERE id = p_parcel_id
    AND (owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role))) THEN
    RAISE EXCEPTION 'No tiene permisos para eliminar esta parcela';
  END IF;
  DELETE FROM public.parcels WHERE id = p_parcel_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parcela no encontrada'; END IF;
END;
$$;

ALTER TABLE public.technician_farmer_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "assignments admin manage" ON public.technician_farmer_assignments;
CREATE POLICY "assignments admin manage" ON public.technician_farmer_assignments FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role)) WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
DROP POLICY IF EXISTS "settings admin manage" ON public.alert_settings;
CREATE POLICY "settings admin manage" ON public.alert_settings FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role)) WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

-- Técnicos sólo pueden consultar agricultores explícitamente asignados. Administradores conservan supervisión global.
DROP POLICY IF EXISTS "parcels owner read" ON public.parcels;
CREATE POLICY "parcels owner read" ON public.parcels FOR SELECT TO authenticated USING (
  owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  OR (public.has_role((SELECT auth.uid()), 'tecnico'::public.app_role) AND public.is_assigned_technician(owner_id)));
DROP POLICY IF EXISTS "inventory owner read" ON public.inventory_items;
CREATE POLICY "inventory owner read" ON public.inventory_items FOR SELECT TO authenticated USING (
  owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  OR (public.has_role((SELECT auth.uid()), 'tecnico'::public.app_role) AND public.is_assigned_technician(owner_id)));

-- Sustituye políticas SELECT previas (permisivas) de los recursos que un técnico consulta.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('profiles', 'crops', 'activities', 'alerts') AND cmd IN ('SELECT', 'ALL')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename); END LOOP;
END $$;
CREATE POLICY "profiles own admin or assigned technician" ON public.profiles FOR SELECT TO authenticated USING (
  id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  OR (public.has_role((SELECT auth.uid()), 'tecnico'::public.app_role) AND public.is_assigned_technician(id)));
CREATE POLICY "crops owner admin or assigned technician" ON public.crops FOR SELECT TO authenticated USING (
  public.has_role((SELECT auth.uid()), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.parcels p WHERE p.id = parcel_id AND
  (p.owner_id = (SELECT auth.uid()) OR (public.has_role((SELECT auth.uid()), 'tecnico'::public.app_role) AND public.is_assigned_technician(p.owner_id)))));
CREATE POLICY "activities owner admin or assigned technician" ON public.activities FOR SELECT TO authenticated USING (
  public.has_role((SELECT auth.uid()), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id
  WHERE c.id = crop_id AND (p.owner_id = (SELECT auth.uid()) OR (public.has_role((SELECT auth.uid()), 'tecnico'::public.app_role) AND public.is_assigned_technician(p.owner_id)))));
CREATE POLICY "alerts recipient admin or assigned technician" ON public.alerts FOR SELECT TO authenticated USING (
  user_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  OR (public.has_role((SELECT auth.uid()), 'tecnico'::public.app_role) AND public.is_assigned_technician(user_id)));
DROP POLICY IF EXISTS "profiles own update" ON public.profiles;
DROP POLICY IF EXISTS "crops owner write" ON public.crops;
DROP POLICY IF EXISTS "activities owner write" ON public.activities;
DROP POLICY IF EXISTS "alerts recipient status update" ON public.alerts;
CREATE POLICY "profiles own update" ON public.profiles FOR UPDATE TO authenticated USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY "crops owner write" ON public.crops FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.parcels p WHERE p.id = parcel_id AND (p.owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)))
) WITH CHECK (EXISTS (SELECT 1 FROM public.parcels p WHERE p.id = parcel_id AND (p.owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role))));
CREATE POLICY "activities owner write" ON public.activities FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id AND (p.owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)))
) WITH CHECK (EXISTS (SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id AND (p.owner_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role))));
CREATE POLICY "alerts recipient status update" ON public.alerts FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)) WITH CHECK (user_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS "alerts manual insert" ON public.alerts;
CREATE POLICY "alerts manual insert" ON public.alerts FOR INSERT TO authenticated WITH CHECK (
  user_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  OR (public.has_role((SELECT auth.uid()), 'tecnico'::public.app_role) AND public.is_assigned_technician(user_id)));

REVOKE EXECUTE ON FUNCTION public.delete_parcel_cascade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_parcel_cascade(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_assigned_technician(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_assigned_technician(uuid) TO authenticated;
