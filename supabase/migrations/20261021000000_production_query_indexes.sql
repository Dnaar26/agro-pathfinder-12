-- Índices para las consultas de navegación, reportes y alertas más frecuentes.
-- IF NOT EXISTS permite aplicar la migración varias veces sin modificar datos.

CREATE INDEX IF NOT EXISTS parcels_owner_id_idx
  ON public.parcels (owner_id);

CREATE INDEX IF NOT EXISTS parcels_created_at_idx
  ON public.parcels (created_at DESC);

CREATE INDEX IF NOT EXISTS crops_parcel_id_idx
  ON public.crops (parcel_id);

CREATE INDEX IF NOT EXISTS crops_status_idx
  ON public.crops (status);

CREATE INDEX IF NOT EXISTS activities_crop_id_idx
  ON public.activities (crop_id);

CREATE INDEX IF NOT EXISTS activities_performed_at_idx
  ON public.activities (performed_at DESC);

CREATE INDEX IF NOT EXISTS crop_harvests_crop_id_idx
  ON public.crop_harvests (crop_id);

CREATE INDEX IF NOT EXISTS crop_harvests_performed_at_idx
  ON public.crop_harvests (performed_at DESC);

CREATE INDEX IF NOT EXISTS crop_costs_crop_id_idx
  ON public.crop_costs (crop_id);

CREATE INDEX IF NOT EXISTS crop_costs_created_at_idx
  ON public.crop_costs (created_at DESC);

CREATE INDEX IF NOT EXISTS alerts_user_status_scheduled_idx
  ON public.alerts (user_id, status, scheduled_at DESC);

CREATE INDEX IF NOT EXISTS calendar_events_crop_starts_idx
  ON public.calendar_events (crop_id, starts_at);

CREATE INDEX IF NOT EXISTS inventory_items_owner_id_idx
  ON public.inventory_items (owner_id);

CREATE INDEX IF NOT EXISTS inventory_movements_item_created_idx
  ON public.inventory_movements (item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS scheduled_reports_user_enabled_idx
  ON public.scheduled_reports (user_id, enabled);

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx
  ON public.audit_log (created_at DESC);
