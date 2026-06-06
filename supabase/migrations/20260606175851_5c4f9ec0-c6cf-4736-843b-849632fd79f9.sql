-- 1. user_roles: admin can manage
CREATE POLICY "roles admin manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. profiles: tecnico/admin can read all
CREATE POLICY "profiles staff read" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'tecnico') OR public.has_role(auth.uid(), 'admin'));

-- 3. Storage policies for 'evidences' bucket
-- folder convention: <user_id>/<crop_id>/<filename>
CREATE POLICY "evidences owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'evidences'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'tecnico')
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "evidences owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'evidences'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "evidences owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'evidences'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- 4. Automatic alerts generator (SQL only)
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.generate_automatic_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark overdue pending alerts as VENCIDA
  UPDATE public.alerts
  SET status = 'VENCIDA'
  WHERE status = 'PENDIENTE' AND scheduled_at < now() - interval '1 day';

  -- Cosecha próxima (next 7 days), one alert per crop max
  INSERT INTO public.alerts (user_id, crop_id, kind, title, body, scheduled_at, status)
  SELECT p.owner_id, c.id, 'COSECHA',
         'Cosecha próxima: ' || cc.name,
         'La cosecha estimada es el ' || to_char(c.estimated_harvest_date, 'DD Mon YYYY'),
         c.estimated_harvest_date::timestamptz, 'PENDIENTE'
  FROM public.crops c
  JOIN public.parcels p ON p.id = c.parcel_id
  JOIN public.crop_catalog cc ON cc.id = c.catalog_id
  WHERE c.estimated_harvest_date BETWEEN current_date AND current_date + interval '7 days'
    AND c.status NOT IN ('FINALIZADO','POSTCOSECHA')
    AND NOT EXISTS (
      SELECT 1 FROM public.alerts a
      WHERE a.crop_id = c.id AND a.kind = 'COSECHA' AND a.status = 'PENDIENTE'
    );

  -- Riego pendiente: cultivos activos sin RIEGO en los últimos 4 días
  INSERT INTO public.alerts (user_id, crop_id, kind, title, body, scheduled_at, status)
  SELECT p.owner_id, c.id, 'RIEGO',
         'Riego pendiente: ' || cc.name,
         'No se ha registrado riego en los últimos 4 días.',
         now(), 'PENDIENTE'
  FROM public.crops c
  JOIN public.parcels p ON p.id = c.parcel_id
  JOIN public.crop_catalog cc ON cc.id = c.catalog_id
  WHERE c.status IN ('SEMBRADO','CRECIMIENTO','MANTENIMIENTO')
    AND NOT EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.crop_id = c.id AND a.kind = 'RIEGO' AND a.performed_at > now() - interval '4 days'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.alerts a
      WHERE a.crop_id = c.id AND a.kind = 'RIEGO' AND a.status = 'PENDIENTE'
        AND a.created_at > now() - interval '1 day'
    );
END;
$$;

-- Schedule daily at 6 AM (idempotent)
SELECT cron.unschedule('sgic-generate-alerts') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sgic-generate-alerts');
SELECT cron.schedule('sgic-generate-alerts', '0 6 * * *', $$ SELECT public.generate_automatic_alerts(); $$);