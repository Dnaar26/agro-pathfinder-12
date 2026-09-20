-- Añade índices en todas las columnas foráneas para acelerar JOINs
-- Auditoría hallazgo E3: 9 tablas con FK sin índice

CREATE INDEX IF NOT EXISTS idx_parcels_owner_id ON public.parcels(owner_id);
CREATE INDEX IF NOT EXISTS idx_parcels_soil_type_id ON public.parcels(soil_type_id);
CREATE INDEX IF NOT EXISTS idx_crops_parcel_id ON public.crops(parcel_id);
CREATE INDEX IF NOT EXISTS idx_crops_catalog_id ON public.crops(catalog_id);
CREATE INDEX IF NOT EXISTS idx_activities_crop_id ON public.activities(crop_id);
CREATE INDEX IF NOT EXISTS idx_activities_responsible_id ON public.activities(responsible_id);
CREATE INDEX IF NOT EXISTS idx_crop_costs_crop_id ON public.crop_costs(crop_id);
CREATE INDEX IF NOT EXISTS idx_crop_harvests_crop_id ON public.crop_harvests(crop_id);
CREATE INDEX IF NOT EXISTS idx_pest_incidents_crop_id ON public.pest_incidents(crop_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON public.alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON public.calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_owner_id ON public.inventory_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_batches_crop_id ON public.batches(crop_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON public.audit_log(record_id);
