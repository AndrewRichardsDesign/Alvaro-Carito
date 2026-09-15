-- Guests watching the page should see a new photo appear without refreshing.
alter publication supabase_realtime add table public.photos;
