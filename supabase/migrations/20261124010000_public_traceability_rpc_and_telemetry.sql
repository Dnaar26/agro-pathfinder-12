-- 1. RPC segura de Trazabilidad Publica (oculta owner_id, poligonos y redondea GPS en servidor)
CREATE OR REPLACE FUNCTION public.get_public_trace_batch(p_batch_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_code text := btrim(COALESCE(p_batch_code, ''));
  v_payload jsonb;
BEGIN
  IF v_clean_code = '' OR char_length(v_clean_code) > 80 THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'batch_code', b.batch_code,
    'harvest_date', b.harvest_date,
    'qty', COALESCE(b.qty, b.quantity, 0),
    'unit', COALESCE(b.unit, 'kg'),
    'globalgap_cert', COALESCE(b.globalgap_cert, false),
    'notes', b.notes,
    'crop_name', cat.name,
    'planting_date', c.planting_date,
    'parcel_name', p.name,
    'approx_latitude', CASE WHEN p.latitude IS NOT NULL THEN ROUND(p.latitude::numeric, 2) ELSE NULL END,
    'approx_longitude', CASE WHEN p.longitude IS NOT NULL THEN ROUND(p.longitude::numeric, 2) ELSE NULL END,
    'farmer_name', pr.full_name
  )
  INTO v_payload
  FROM public.batches b
  LEFT JOIN public.crops c ON c.id = b.crop_id
  LEFT JOIN public.crop_catalog cat ON cat.id = c.catalog_id
  LEFT JOIN public.parcels p ON p.id = c.parcel_id
  LEFT JOIN public.profiles pr ON pr.id = p.owner_id
  WHERE b.batch_code = v_clean_code
  LIMIT 1;

  RETURN v_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_trace_batch(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_trace_batch(text) TO anon, authenticated;

-- 2. Tabla de Telemetria Real de Errores de Produccion (reemplaza colector mudo de previsualizacion)
CREATE TABLE IF NOT EXISTS public.client_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route text NOT NULL CHECK (char_length(route) <= 300),
  boundary text NOT NULL DEFAULT 'app' CHECK (char_length(boundary) <= 120),
  message text NOT NULL CHECK (char_length(message) <= 2000),
  stack text NULL CHECK (stack IS NULL OR char_length(stack) <= 6000),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_error_logs_created_at
  ON public.client_error_logs (created_at DESC);

ALTER TABLE public.client_error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users insert own error logs" ON public.client_error_logs;
CREATE POLICY "Authenticated users insert own error logs"
  ON public.client_error_logs
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins view client error logs" ON public.client_error_logs;
CREATE POLICY "Admins view client error logs"
  ON public.client_error_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
