-- Final hardening for the security findings V1-V13.

-- Evidence uploads must remain private and limited to image MIME types at storage level.
UPDATE storage.buckets
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
WHERE id = 'evidences';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'evidences', 'evidences', false, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'evidences');

-- Avoid accidental privilege drift from older FOR ALL policies.
DROP POLICY IF EXISTS "roles admin manage" ON public.user_roles;
CREATE POLICY "roles admin select" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());
CREATE POLICY "roles admin insert" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles admin update" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles admin delete" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Audit logs are append-only from triggers/server logic; clients can only read them as admin.
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit admin read" ON public.audit_log;
DROP POLICY IF EXISTS "audit no client writes" ON public.audit_log;
CREATE POLICY "audit admin read" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "audit no client writes" ON public.audit_log FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

-- Reassert parcel delete restriction from the RLS bug finding.
DROP POLICY IF EXISTS "parcels delete" ON public.parcels;
CREATE POLICY "parcels delete" ON public.parcels FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
