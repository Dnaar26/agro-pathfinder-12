CREATE EXTENSION IF NOT EXISTS pgtap;

BEGIN;

SELECT plan(25);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.profiles'::regclass),
  'profiles has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.parcels'::regclass),
  'parcels has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.inventory_items'::regclass),
  'inventory_items has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.audit_log'::regclass),
  'audit_log has RLS enabled'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_roles'::regclass
      AND contype = 'u'
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.user_roles'::regclass AND attname = 'user_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.user_roles'::regclass AND attname = 'role')
      ]::smallint[]
  ),
  'user roles cannot be duplicated'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = 'public.log_audit()'::regprocedure
      AND proconfig @> ARRAY['search_path=public']
  ),
  'log_audit has a fixed search_path'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = 'public.set_updated_at()'::regprocedure
      AND proconfig @> ARRAY['search_path=public']
  ),
  'set_updated_at has a fixed search_path'
);

-- PostgreSQL serializes an explicitly empty search_path as search_path="".
-- Check the setting name and normalized value rather than relying on an
-- unquoted array literal such as search_path=.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    CROSS JOIN LATERAL unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS config(setting)
    WHERE p.oid = 'public.apply_inventory_movement(uuid,text,numeric,text,numeric)'::regprocedure
      AND split_part(config.setting, '=', 1) = 'search_path'
      AND btrim(split_part(config.setting, '=', 2), '"') = ''
  ),
  'inventory RPC has an empty search_path'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    CROSS JOIN LATERAL unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS config(setting)
    WHERE p.oid = 'public.has_role(uuid,public.app_role)'::regprocedure
      AND split_part(config.setting, '=', 1) = 'search_path'
      AND btrim(split_part(config.setting, '=', 2), '"') = ''
  ),
  'has_role has an empty search_path'
);

SELECT ok(
  NOT has_function_privilege('public', 'public.log_audit()', 'execute'),
  'log_audit is not executable by PUBLIC'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.log_audit()', 'execute'),
  'log_audit is not executable by anon'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.apply_inventory_movement(uuid,text,numeric,text,numeric)', 'execute'),
  'authenticated can use the inventory RPC'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.apply_inventory_movement(uuid,text,numeric,text,numeric)', 'execute'),
  'anon cannot use the inventory RPC'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.calendar_events'::regclass),
  'calendar_events has RLS enabled'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.calendar_events'::regclass
      AND attname = 'done'
      AND attnotnull
      AND NOT attisdropped
  ),
  'calendar event completion state cannot be NULL'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = 'public.calendar_events'::regclass
      AND a.attname = 'done'
      AND pg_get_expr(d.adbin, d.adrelid) = 'false'
  ),
  'calendar events default to pending'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.inventory_movements'::regclass
      AND attname = 'calendar_event_id'
      AND NOT attisdropped
  ),
  'inventory movements can be linked to calendar events'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'calendar_events'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
  ),
  'calendar event writes are restricted to transactional RPCs'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = 'public.create_calendar_event_with_inventory(text,timestamptz,text,uuid,uuid,numeric)'::regprocedure
      AND proconfig @> ARRAY['search_path=public']
  ),
  'calendar creation RPC has a fixed search_path'
);
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.create_calendar_event_with_inventory(text,timestamptz,text,uuid,uuid,numeric)',
    'execute'
  ),
  'authenticated can create calendar events transactionally'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.create_calendar_event_with_inventory(text,timestamptz,text,uuid,uuid,numeric)',
    'execute'
  ),
  'anon cannot create calendar events transactionally'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.transition_crop_status(uuid,public.crop_status)', 'execute'),
  'authenticated can transition crop status through the RPC'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.crops'::regclass
      AND tgname = 'crops_prevent_direct_status_change'
      AND NOT tgisinternal
  ),
  'direct crop status changes are guarded by a trigger'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.inventory_movements'::regclass
      AND tgname = 'inventory_movements_protect_calendar_link'
      AND NOT tgisinternal
  ),
  'calendar-linked inventory movements are protected by a trigger'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.transition_crop_statuses(uuid[],public.crop_status)', 'execute'),
  'authenticated can bulk transition crop status through the RPC'
);

SELECT * FROM finish();
ROLLBACK;
