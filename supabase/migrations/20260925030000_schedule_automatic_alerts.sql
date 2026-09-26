-- Ejecuta recordatorios de siembra y alertas de stock cada día a las 07:00 UTC.
-- generate_automatic_alerts admite ejecuciones internas sin auth.uid().
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-automatic-alerts-daily') THEN
    PERFORM cron.unschedule('generate-automatic-alerts-daily');
  END IF;
  PERFORM cron.schedule(
    'generate-automatic-alerts-daily',
    '0 7 * * *',
    'SELECT public.generate_automatic_alerts();'
  );
END;
$$;
