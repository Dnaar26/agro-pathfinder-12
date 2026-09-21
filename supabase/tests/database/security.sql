BEGIN;

SELECT plan(12);

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
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = 'public.apply_inventory_movement(uuid,text,numeric,text,numeric)'::regprocedure
      AND proconfig @> ARRAY['search_path=public']
  ),
  'inventory RPC has a fixed search_path'
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

SELECT * FROM finish();
ROLLBACK;
