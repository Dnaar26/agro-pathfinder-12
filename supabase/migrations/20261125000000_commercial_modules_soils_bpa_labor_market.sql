-- ============================================================================
-- Migración v5: Módulos Comerciales SIGIC
-- 1. Laboratorio e Interpretación de Análisis de Suelos (public.soil_analyses)
-- 2. Certificación BPA / ICA & GLOBALG.A.P. (public.bpa_evaluations)
-- 3. Control de Mano de Obra y Jornales (public.field_labor_logs)
-- 4. Vitrina Comercial y Preventa de Cosechas (public.harvest_listings)
-- ============================================================================

-- 1. ANÁLISIS DE SUELOS
CREATE TABLE IF NOT EXISTS public.soil_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id uuid NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  sample_date date NOT NULL DEFAULT CURRENT_DATE,
  ph numeric(4,2) NOT NULL CHECK (ph >= 2.5 AND ph <= 10.5),
  organic_matter_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (organic_matter_pct >= 0 AND organic_matter_pct <= 100),
  nitrogen_ppm numeric(8,2) NULL CHECK (nitrogen_ppm IS NULL OR nitrogen_ppm >= 0),
  phosphorus_ppm numeric(8,2) NOT NULL DEFAULT 0 CHECK (phosphorus_ppm >= 0),
  potassium_cmol numeric(6,2) NOT NULL DEFAULT 0 CHECK (potassium_cmol >= 0),
  cec_cmol numeric(6,2) NOT NULL DEFAULT 10 CHECK (cec_cmol > 0),
  aluminum_cmol numeric(6,2) NOT NULL DEFAULT 0 CHECK (aluminum_cmol >= 0),
  texture text NOT NULL DEFAULT 'Franco',
  lab_name text NULL,
  notes text NULL CHECK (notes IS NULL OR char_length(notes) <= 1000),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_soil_analyses_parcel_date
  ON public.soil_analyses (parcel_id, sample_date DESC);

ALTER TABLE public.soil_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "soil analyses scoped read" ON public.soil_analyses;
CREATE POLICY "soil analyses scoped read"
  ON public.soil_analyses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = parcel_id
        AND (
          p.owner_id = (SELECT auth.uid())
          OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
          OR (
            public.has_role((SELECT auth.uid()), 'tecnico'::public.app_role)
            AND public.is_assigned_technician(p.owner_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS "soil analyses scoped insert" ON public.soil_analyses;
CREATE POLICY "soil analyses scoped insert"
  ON public.soil_analyses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = parcel_id
        AND (
          p.owner_id = (SELECT auth.uid())
          OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
          OR (
            public.has_role((SELECT auth.uid()), 'tecnico'::public.app_role)
            AND public.is_assigned_technician(p.owner_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS "soil analyses owner admin delete" ON public.soil_analyses;
CREATE POLICY "soil analyses owner admin delete"
  ON public.soil_analyses
  FOR DELETE
  TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = parcel_id AND p.owner_id = (SELECT auth.uid())
    )
  );

-- 2. EVALUACIONES BPA / ICA & GLOBALG.A.P.
CREATE TABLE IF NOT EXISTS public.bpa_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id uuid NOT NULL REFERENCES public.crops(id) ON DELETE CASCADE,
  batch_id uuid NULL REFERENCES public.batches(id) ON DELETE SET NULL,
  evaluator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  evaluator_name text NOT NULL CHECK (char_length(evaluator_name) BETWEEN 2 AND 140),
  evaluator_role text NOT NULL DEFAULT 'agricultor',
  checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  compliance_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (compliance_score >= 0 AND compliance_score <= 100),
  status text NOT NULL DEFAULT 'EN_REVISION' CHECK (status IN ('EN_REVISION', 'APROBADO_BPA', 'CON_HALLAZGOS')),
  notes text NULL CHECK (notes IS NULL OR char_length(notes) <= 1000),
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bpa_evaluations_crop
  ON public.bpa_evaluations (crop_id, evaluated_at DESC);

ALTER TABLE public.bpa_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bpa evaluations scoped read" ON public.bpa_evaluations;
CREATE POLICY "bpa evaluations scoped read"
  ON public.bpa_evaluations
  FOR SELECT
  TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR public.can_access_crop(crop_id)
  );

DROP POLICY IF EXISTS "bpa evaluations scoped insert" ON public.bpa_evaluations;
CREATE POLICY "bpa evaluations scoped insert"
  ON public.bpa_evaluations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    evaluator_id = (SELECT auth.uid())
    AND (
      public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
      OR public.can_access_crop(crop_id)
    )
  );

DROP POLICY IF EXISTS "bpa evaluations owner admin delete" ON public.bpa_evaluations;
CREATE POLICY "bpa evaluations owner admin delete"
  ON public.bpa_evaluations
  FOR DELETE
  TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR evaluator_id = (SELECT auth.uid())
  );

-- RPC para avalar lote trazable cuando la auditoría BPA supera el 80%
CREATE OR REPLACE FUNCTION public.certify_batch_from_bpa(p_batch_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_crop_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT crop_id INTO v_crop_id FROM public.batches WHERE id = p_batch_id;
  IF v_crop_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT (
    public.has_role(v_uid, 'admin'::public.app_role)
    OR public.can_access_crop(v_crop_id)
  ) THEN
    RAISE EXCEPTION 'Sin permisos sobre este lote';
  END IF;

  UPDATE public.batches
  SET globalgap_cert = true, updated_at = now()
  WHERE id = p_batch_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.certify_batch_from_bpa(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.certify_batch_from_bpa(uuid) TO authenticated;

-- 3. CONTROL DE MANO DE OBRA Y JORNALES
CREATE TABLE IF NOT EXISTS public.field_labor_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crop_id uuid NOT NULL REFERENCES public.crops(id) ON DELETE CASCADE,
  worker_name text NOT NULL CHECK (char_length(worker_name) BETWEEN 2 AND 120),
  task_kind text NOT NULL DEFAULT 'MANTENIMIENTO',
  payment_mode text NOT NULL DEFAULT 'JORNAL_DIA' CHECK (payment_mode IN ('JORNAL_DIA', 'DESTAJO_KG')),
  units_worked numeric(10,2) NOT NULL CHECK (units_worked > 0),
  rate_cop numeric(12,2) NOT NULL CHECK (rate_cop >= 0),
  total_cop numeric(14,2) NOT NULL CHECK (total_cop >= 0),
  work_date date NOT NULL DEFAULT CURRENT_DATE,
  paid boolean NOT NULL DEFAULT false,
  linked_cost_id uuid NULL REFERENCES public.crop_costs(id) ON DELETE SET NULL,
  notes text NULL CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_field_labor_logs_owner_date
  ON public.field_labor_logs (owner_id, work_date DESC);

ALTER TABLE public.field_labor_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "field labor scoped read" ON public.field_labor_logs;
CREATE POLICY "field labor scoped read"
  ON public.field_labor_logs
  FOR SELECT
  TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR (
      public.has_role((SELECT auth.uid()), 'tecnico'::public.app_role)
      AND public.is_assigned_technician(owner_id)
    )
  );

DROP POLICY IF EXISTS "field labor owner admin write" ON public.field_labor_logs;
CREATE POLICY "field labor owner admin write"
  ON public.field_labor_logs
  FOR ALL
  TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  )
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

-- 4. VITRINA COMERCIAL Y PREVENTA DE COSECHAS
CREATE TABLE IF NOT EXISTS public.harvest_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crop_id uuid NULL REFERENCES public.crops(id) ON DELETE SET NULL,
  batch_id uuid NULL REFERENCES public.batches(id) ON DELETE SET NULL,
  farmer_display_name text NOT NULL DEFAULT 'Productor SIGIC',
  product_name text NOT NULL CHECK (char_length(product_name) BETWEEN 2 AND 100),
  variety text NULL CHECK (variety IS NULL OR char_length(variety) <= 80),
  available_qty numeric(12,2) NOT NULL CHECK (available_qty > 0),
  unit text NOT NULL DEFAULT 'KG',
  min_order_qty numeric(12,2) NOT NULL DEFAULT 1 CHECK (min_order_qty > 0),
  price_per_unit numeric(12,2) NOT NULL CHECK (price_per_unit > 0),
  available_from date NOT NULL DEFAULT CURRENT_DATE,
  location_label text NOT NULL DEFAULT 'Colombia',
  whatsapp_phone text NULL CHECK (whatsapp_phone IS NULL OR char_length(whatsapp_phone) <= 25),
  bpa_verified boolean NOT NULL DEFAULT false,
  batch_code text NULL,
  status text NOT NULL DEFAULT 'PREVENTA' CHECK (status IN ('PREVENTA', 'DISPONIBLE', 'RESERVADO', 'VENDIDO')),
  notes text NULL CHECK (notes IS NULL OR char_length(notes) <= 600),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_harvest_listings_status_date
  ON public.harvest_listings (status, available_from ASC);

ALTER TABLE public.harvest_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "harvest listings marketplace read" ON public.harvest_listings;
CREATE POLICY "harvest listings marketplace read"
  ON public.harvest_listings
  FOR SELECT
  TO authenticated
  USING (
    status IN ('PREVENTA', 'DISPONIBLE', 'RESERVADO')
    OR owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "harvest listings owner admin write" ON public.harvest_listings;
CREATE POLICY "harvest listings owner admin write"
  ON public.harvest_listings
  FOR ALL
  TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  )
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );
