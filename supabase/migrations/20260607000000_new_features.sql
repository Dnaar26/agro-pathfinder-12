-- ============ NEW ENUMS ============
CREATE TYPE public.inventory_movement_kind AS ENUM ('ENTRADA','SALIDA','AJUSTE');
CREATE TYPE public.unit_type AS ENUM ('KG','L','UN','SACO','BULTO','GR');

-- ============ POLYGON GEOMETRY ON PARCELS ============
ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS geometry JSONB;
ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS polygon_area_m2 NUMERIC(12,2);

-- ============ INVENTORY / INSUMOS ============
CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit public.unit_type NOT NULL DEFAULT 'KG',
  stock_qty NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_stock NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory owner" ON public.inventory_items FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  kind public.inventory_movement_kind NOT NULL,
  qty NUMERIC(10,2) NOT NULL,
  unit_cost NUMERIC(10,2),
  notes TEXT,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "movements owner" ON public.inventory_movements FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.inventory_items i WHERE i.id = item_id AND (i.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS(SELECT 1 FROM public.inventory_items i WHERE i.id = item_id AND (i.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- ============ COSTS / RENTABILIDAD ============
CREATE TABLE public.crop_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id UUID NOT NULL REFERENCES public.crops(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  description TEXT,
  qty NUMERIC(10,2),
  unit TEXT,
  unit_cost NUMERIC(10,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crop_costs TO authenticated;
GRANT ALL ON public.crop_costs TO service_role;
ALTER TABLE public.crop_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "costs via crop" ON public.crop_costs FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TABLE public.crop_harvests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id UUID NOT NULL REFERENCES public.crops(id) ON DELETE CASCADE,
  harvested_qty NUMERIC(10,2) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'KG',
  sale_price NUMERIC(10,2),
  total_revenue NUMERIC(12,2),
  notes TEXT,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crop_harvests TO authenticated;
GRANT ALL ON public.crop_harvests TO service_role;
ALTER TABLE public.crop_harvests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "harvests via crop" ON public.crop_harvests FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- ============ TRAZABILIDAD / QR / LOTES ============
CREATE TABLE public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id UUID NOT NULL REFERENCES public.crops(id) ON DELETE CASCADE,
  batch_code TEXT NOT NULL UNIQUE,
  harvest_date DATE,
  qty NUMERIC(10,2),
  unit TEXT DEFAULT 'KG',
  qr_code TEXT,
  notes TEXT,
  globalgap_cert BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batches TO authenticated;
GRANT ALL ON public.batches TO service_role;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "batches via crop" ON public.batches FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id = c.parcel_id WHERE c.id = crop_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- ============ AUDIT LOG ============
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit admin read" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_data)
    VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, OLD.id::text, row_to_json(OLD)::jsonb);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, NEW.id::text, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
    RETURN NEW;
  ELSE
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, new_data)
    VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, NEW.id::text, row_to_json(NEW)::jsonb);
    RETURN NEW;
  END IF;
END; $$;

CREATE TRIGGER parcels_audit AFTER INSERT OR UPDATE OR DELETE ON public.parcels
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER user_roles_audit AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- ============ NDVI CACHE ============
CREATE TABLE public.ndvi_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id UUID NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  ndvi NUMERIC(5,3),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT DEFAULT 'sentinel2',
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(parcel_id, date)
);
GRANT SELECT, INSERT, UPDATE ON public.ndvi_cache TO authenticated;
GRANT ALL ON public.ndvi_cache TO service_role;
ALTER TABLE public.ndvi_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ndvi via parcel" ON public.ndvi_cache FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.parcels p WHERE p.id = parcel_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))));

-- ============ WEATHER CACHE ============
CREATE TABLE public.weather_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id UUID NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  forecast JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.weather_cache TO authenticated;
GRANT ALL ON public.weather_cache TO service_role;
ALTER TABLE public.weather_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weather via parcel" ON public.weather_cache FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.parcels p WHERE p.id = parcel_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))));

-- ============ PUSH SUBSCRIPTIONS ============
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push own" ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ EMAIL REPORTS ============
CREATE TABLE public.scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template TEXT NOT NULL,
  recipients TEXT[] NOT NULL DEFAULT '{}',
  schedule TEXT NOT NULL DEFAULT 'weekly',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_reports TO authenticated;
GRANT ALL ON public.scheduled_reports TO service_role;
ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports own" ON public.scheduled_reports FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Add alert kind for weather
ALTER TYPE public.alert_kind ADD VALUE IF NOT EXISTS 'HELADA';
ALTER TYPE public.alert_kind ADD VALUE IF NOT EXISTS 'STOCK';
