-- ============================================================
-- Migración: 20260920000000_fix_critical_bugs.sql
-- Descripción: Correcciones críticas detectadas en revisión de
--   auditoría SIGIC — 20 de septiembre de 2026
--
-- Cambios incluidos:
--   1. Restricción CHECK para stock no negativo en inventory_items
--   2. GRANTs faltantes sobre public.pest_incidents
--   3. Trigger de updated_at automático para inventory_items
-- ============================================================

-- ------------------------------------------------------------
-- 1. Restricción CHECK: stock_qty no puede ser negativo
--    Evita que registros de inventario queden con saldo
--    negativo por errores en lógica de aplicación.
-- ------------------------------------------------------------
ALTER TABLE public.inventory_items
  ADD CONSTRAINT inventory_items_stock_qty_non_negative CHECK (stock_qty >= 0);

-- ------------------------------------------------------------
-- 2. GRANTs faltantes para pest_incidents
--    El rol `authenticated` necesita permisos completos sobre
--    esta tabla para que los usuarios puedan registrar y
--    gestionar incidentes de plagas desde la aplicación.
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pest_incidents TO authenticated;

-- ------------------------------------------------------------
-- 3. Función y trigger de updated_at para inventory_items
--    Garantiza que la columna updated_at se actualice
--    automáticamente en cada UPDATE, sin depender de la
--    extensión moddatetime.
-- ------------------------------------------------------------

-- Función reutilizable para cualquier tabla con updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Eliminar el trigger anterior si existe (idempotente)
DROP TRIGGER IF EXISTS set_inventory_items_updated_at ON public.inventory_items;

-- Crear el trigger sobre inventory_items
CREATE TRIGGER set_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
