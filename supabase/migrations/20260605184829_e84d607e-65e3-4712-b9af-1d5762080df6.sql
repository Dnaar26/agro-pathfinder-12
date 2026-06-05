
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('agricultor','tecnico','admin');
CREATE TYPE public.crop_status AS ENUM ('PLANEADO','SEMBRADO','CRECIMIENTO','MANTENIMIENTO','COSECHA','POSTCOSECHA','FINALIZADO');
CREATE TYPE public.activity_kind AS ENUM ('RIEGO','FERTILIZACION','CONTROL_PLAGAS','PODA','INSUMOS','COSECHA','MONITOREO');
CREATE TYPE public.alert_kind AS ENUM ('RIEGO','FERTILIZACION','COSECHA','CLIMA','VENCIDA');
CREATE TYPE public.alert_status AS ENUM ('PENDIENTE','ATENDIDA','DESCARTADA');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile self read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profile self upsert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profile self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Trigger: crear profile + rol agricultor por defecto al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'agricultor');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- helper updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ CATÁLOGOS ============
CREATE TABLE public.soil_types (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
);
GRANT SELECT ON public.soil_types TO authenticated;
GRANT ALL ON public.soil_types TO service_role;
ALTER TABLE public.soil_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "soil read" ON public.soil_types FOR SELECT TO authenticated USING (true);

INSERT INTO public.soil_types (code,name) VALUES
 ('FRANCO','Franco'),('ARCILLOSO','Arcilloso'),('ARENOSO','Arenoso'),
 ('LIMOSO','Limoso'),('FRANCO_ARCILLOSO','Franco arcilloso');

CREATE TABLE public.crop_catalog (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  cycle_days INT NOT NULL CHECK (cycle_days > 0)
);
GRANT SELECT ON public.crop_catalog TO authenticated;
GRANT ALL ON public.crop_catalog TO service_role;
ALTER TABLE public.crop_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog read" ON public.crop_catalog FOR SELECT TO authenticated USING (true);

INSERT INTO public.crop_catalog (code,name,cycle_days) VALUES
 ('MAIZ','Maíz',120),('FRIJOL','Frijol',90),('CAFE','Café',270),
 ('PLATANO','Plátano',300),('YUCA','Yuca',270),('PAPA','Papa',110),
 ('TOMATE','Tomate',95),('CACAO','Cacao',365);

-- ============ PARCELAS ============
CREATE TABLE public.parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  soil_type_id INT REFERENCES public.soil_types(id),
  area_m2 NUMERIC(12,2) NOT NULL CHECK (area_m2 > 0),
  latitude NUMERIC(10,6),
  longitude NUMERIC(10,6),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_parcels_owner ON public.parcels(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parcels TO authenticated;
GRANT ALL ON public.parcels TO service_role;
ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parcels owner all" ON public.parcels FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER parcels_updated BEFORE UPDATE ON public.parcels
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ CULTIVOS ============
CREATE TABLE public.crops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id UUID NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  catalog_id INT NOT NULL REFERENCES public.crop_catalog(id),
  planting_date DATE NOT NULL,
  estimated_harvest_date DATE NOT NULL,
  status public.crop_status NOT NULL DEFAULT 'PLANEADO',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_crops_parcel ON public.crops(parcel_id);
CREATE INDEX idx_crops_status ON public.crops(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crops TO authenticated;
GRANT ALL ON public.crops TO service_role;
ALTER TABLE public.crops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crops via parcel owner" ON public.crops FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.parcels p WHERE p.id = parcel_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS(SELECT 1 FROM public.parcels p WHERE p.id = parcel_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE TRIGGER crops_updated BEFORE UPDATE ON public.crops
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ACTIVIDADES ============
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id UUID NOT NULL REFERENCES public.crops(id) ON DELETE CASCADE,
  responsible_id UUID NOT NULL REFERENCES auth.users(id),
  kind public.activity_kind NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activities_crop ON public.activities(crop_id);
CREATE INDEX idx_activities_date ON public.activities(performed_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activities via parcel" ON public.activities FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.crops c JOIN public.parcels p ON p.id=c.parcel_id
    WHERE c.id = crop_id
    AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (responsible_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ============ CALENDARIO ============
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crop_id UUID REFERENCES public.crops(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  kind public.activity_kind,
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_user_date ON public.calendar_events(user_id, starts_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events owner" ON public.calendar_events FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ============ ALERTAS ============
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crop_id UUID REFERENCES public.crops(id) ON DELETE CASCADE,
  kind public.alert_kind NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  status public.alert_status NOT NULL DEFAULT 'PENDIENTE',
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alerts_user_status ON public.alerts(user_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts owner" ON public.alerts FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'tecnico') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
