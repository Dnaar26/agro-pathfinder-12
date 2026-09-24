-- ============================================================
-- Migración: 20260920002000_production_db_hardening.sql
-- Descripción: Endurecimiento de base de datos según recomendaciones de linter:
--   1. Fijar search_path en public.set_updated_at()
--   2. Revocar ejecución pública RPC de funciones internas (log_audit)
--   3. Asegurar permisos EXECUTE correctos para authenticated en apply_inventory_movement y has_role
--   4. Optimizar auth.uid() en políticas RLS críticas
-- ============================================================

-- 1. Fijar search_path en set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 2 y 3. Restringir permisos de funciones de forma segura si existen
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_audit') THEN
    REVOKE EXECUTE ON FUNCTION public.log_audit() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.log_audit() FROM anon;
    REVOKE EXECUTE ON FUNCTION public.log_audit() FROM authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'apply_inventory_movement') THEN
    REVOKE EXECUTE ON FUNCTION public.apply_inventory_movement(uuid, text, numeric, text, numeric) FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.apply_inventory_movement(uuid, text, numeric, text, numeric) FROM anon;
    GRANT EXECUTE ON FUNCTION public.apply_inventory_movement(uuid, text, numeric, text, numeric) TO authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role') THEN
    REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
    GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
  END IF;
END $$;

-- 4. Optimizar políticas RLS para auth.uid() en profiles y user_roles
DROP POLICY IF EXISTS "profile staff read all" ON public.profiles;
CREATE POLICY "profile staff read all" ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id OR public.has_role((SELECT auth.uid()), 'tecnico') OR public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS "profile staff update" ON public.profiles;
CREATE POLICY "profile staff update" ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id OR public.has_role((SELECT auth.uid()), 'tecnico') OR public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK ((SELECT auth.uid()) = id OR public.has_role((SELECT auth.uid()), 'tecnico') OR public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS "roles admin select" ON public.user_roles;
CREATE POLICY "roles admin select" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin') OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "roles admin insert" ON public.user_roles;
CREATE POLICY "roles admin insert" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS "roles admin update" ON public.user_roles;
CREATE POLICY "roles admin update" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS "roles admin delete" ON public.user_roles;
CREATE POLICY "roles admin delete" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));
