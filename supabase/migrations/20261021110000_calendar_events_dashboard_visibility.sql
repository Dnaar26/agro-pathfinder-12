-- Normaliza eventos antiguos para que el dashboard pueda reconocerlos como pendientes.
UPDATE public.calendar_events
SET done = false
WHERE done IS NULL;

ALTER TABLE public.calendar_events
  ALTER COLUMN done SET DEFAULT false,
  ALTER COLUMN done SET NOT NULL;

CREATE INDEX IF NOT EXISTS calendar_events_upcoming_idx
  ON public.calendar_events (starts_at)
  WHERE done = false;
