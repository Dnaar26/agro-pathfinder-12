-- ============================================================
-- PRODUCTION HARDENING MIGRATION
-- CHECK constraints, audit triggers, FK indexes, updated_at triggers
-- ============================================================

-- 1. CHECK constraints faltantes
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_stock_qty_check CHECK (stock_qty >= 0);
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_min_stock_check CHECK (min_stock >= 0);
ALTER TABLE public.crops ADD CONSTRAINT crops_harvest_after_planting CHECK (estimated_harvest_date > planting_date);
ALTER TABLE public.crop_harvests ADD CONSTRAINT harvests_qty_positive CHECK (harvested_qty > 0);
ALTER TABLE public.crop_harvests ADD CONSTRAINT harvests_price_non_negative CHECK (sale_price >= 0);
ALTER TABLE public.crop_costs ADD CONSTRAINT costs_unit_cost_positive CHECK (unit_cost >= 0);
ALTER TABLE public.crop_costs ADD CONSTRAINT costs_total_positive CHECK (total >= 0);
ALTER TABLE public.inventory_movements ADD CONSTRAINT movements_qty_non_zero CHECK (qty <> 0);

-- 2. crop_costs.kind: agregar CHECK constraint con valores válidos
ALTER TABLE public.crop_costs ADD CONSTRAINT costs_kind_valid CHECK (kind IN ('INSUMOS', 'MANO_OBRA', 'MAQUINARIA', 'TRANSPORTE', 'OTROS'));

-- 3. scheduled_reports.schedule: CHECK con valores válidos
ALTER TABLE public.scheduled_reports ADD CONSTRAINT reports_schedule_valid CHECK (schedule IN ('daily', 'weekly', 'monthly'));

-- 4. updated_at trigger para inventory_items
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER inventory_items_updated BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Audit triggers para tablas faltantes
CREATE TRIGGER crops_audit AFTER INSERT OR UPDATE OR DELETE ON public.crops FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER activities_audit AFTER INSERT OR UPDATE OR DELETE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER crop_costs_audit AFTER INSERT OR UPDATE OR DELETE ON public.crop_costs FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER crop_harvests_audit AFTER INSERT OR UPDATE OR DELETE ON public.crop_harvests FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER inventory_items_audit AFTER INSERT OR UPDATE OR DELETE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER batches_audit AFTER INSERT OR UPDATE OR DELETE ON public.batches FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER pest_incidents_audit AFTER INSERT OR UPDATE OR DELETE ON public.pest_incidents FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER calendar_events_audit AFTER INSERT OR UPDATE OR DELETE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER alerts_audit AFTER INSERT OR UPDATE OR DELETE ON public.alerts FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- 6. FK indexes faltantes
CREATE INDEX IF NOT EXISTS idx_calendar_events_crop_id ON public.calendar_events(crop_id);
CREATE INDEX IF NOT EXISTS idx_alerts_crop_id ON public.alerts(crop_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_id ON public.inventory_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_ndvi_cache_parcel_id ON public.ndvi_cache(parcel_id);
CREATE INDEX IF NOT EXISTS idx_weather_cache_parcel_id ON public.weather_cache(parcel_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_user_id ON public.scheduled_reports(user_id);
