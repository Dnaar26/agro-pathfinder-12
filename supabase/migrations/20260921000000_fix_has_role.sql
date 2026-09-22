-- ============================================================
-- Migración: 20260921000000_fix_has_role.sql
-- Descripción: Corrige la función has_role() que tenía una
--   condición redundante `_user_id = (SELECT auth.uid())`
--   que impedía que admins verificaran roles de otros usuarios.
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- Mantener permisos correctos
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
