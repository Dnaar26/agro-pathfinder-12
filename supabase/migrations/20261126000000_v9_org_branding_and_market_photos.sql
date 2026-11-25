-- ============================================================================
-- Migración v9: Identidad Institucional (Logo/NIT Cooperativa) y Fotos en Vitrina
-- ============================================================================

ALTER TABLE public.alert_settings
  ADD COLUMN IF NOT EXISTS org_name text NULL CHECK (org_name IS NULL OR char_length(org_name) <= 140),
  ADD COLUMN IF NOT EXISTS org_nit text NULL CHECK (org_nit IS NULL OR char_length(org_nit) <= 40),
  ADD COLUMN IF NOT EXISTS org_municipality text NULL CHECK (org_municipality IS NULL OR char_length(org_municipality) <= 100),
  ADD COLUMN IF NOT EXISTS org_logo_url text NULL CHECK (org_logo_url IS NULL OR char_length(org_logo_url) <= 350000);

-- Permitir lectura autenticada de la identidad institucional para membretes PDF y Certificados
DROP POLICY IF EXISTS "alert settings authenticated read" ON public.alert_settings;
CREATE POLICY "alert settings authenticated read"
  ON public.alert_settings
  FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE public.harvest_listings
  ADD COLUMN IF NOT EXISTS photo_url text NULL CHECK (photo_url IS NULL OR char_length(photo_url) <= 450000);

-- Actualizar RPC pública de vitrina comercial para exponer photo_url sin filtrar owner_id
CREATE OR REPLACE FUNCTION public.get_public_marketplace_listings(
  p_owner_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', h.id,
        'farmer_display_name', h.farmer_display_name,
        'product_name', h.product_name,
        'variety', h.variety,
        'available_qty', h.available_qty,
        'unit', h.unit,
        'min_order_qty', h.min_order_qty,
        'price_per_unit', h.price_per_unit,
        'available_from', h.available_from,
        'location_label', h.location_label,
        'whatsapp_phone', h.whatsapp_phone,
        'bpa_verified', h.bpa_verified,
        'batch_code', h.batch_code,
        'photo_url', h.photo_url,
        'status', h.status,
        'notes', h.notes,
        'created_at', h.created_at
      )
      ORDER BY h.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM public.harvest_listings h
  WHERE h.status IN ('PREVENTA', 'DISPONIBLE')
    AND (p_owner_id IS NULL OR h.owner_id = p_owner_id)
  LIMIT 120;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_marketplace_listings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_marketplace_listings(uuid) TO anon, authenticated;
