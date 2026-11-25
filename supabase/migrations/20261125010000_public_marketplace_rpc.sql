-- ============================================================================
-- Migración v6: RPC Segura para Vitrina Comercial Pública (/vitrina)
-- Permite que compradores externos, cooperativas, restaurantes y mayoristas
-- consulten ofertas activas (PREVENTA y DISPONIBLE) sin iniciar sesión,
-- exponiendo únicamente metadatos comerciales públicos sin filtrar owner_id interno.
-- ============================================================================

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
