-- Add FK constraints from owner/user columns to public.profiles(id)
-- so PostgREST can resolve `profiles!owner_id` / `profiles!user_id` joins

ALTER TABLE public.parcels
  ADD CONSTRAINT parcels_owner_id_fkey_profiles
  FOREIGN KEY (owner_id) REFERENCES public.profiles(id);

ALTER TABLE public.alerts
  ADD CONSTRAINT alerts_user_id_fkey_profiles
  FOREIGN KEY (user_id) REFERENCES public.profiles(id);

ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_user_id_fkey_profiles
  FOREIGN KEY (user_id) REFERENCES public.profiles(id);

ALTER TABLE public.inventory_items
  ADD CONSTRAINT inventory_items_owner_id_fkey_profiles
  FOREIGN KEY (owner_id) REFERENCES public.profiles(id);
