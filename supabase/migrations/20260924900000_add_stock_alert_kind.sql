-- Se separa para que PostgreSQL pueda usar el nuevo valor enum en la siguiente migración.
ALTER TYPE public.alert_kind ADD VALUE IF NOT EXISTS 'STOCK';
