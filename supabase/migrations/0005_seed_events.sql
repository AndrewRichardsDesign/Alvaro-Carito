-- A starting set of events, so the WhatsApp picker has something to offer on
-- day one. Edit or delete them from the site's admin panel; with no events at
-- all, guests are never asked anything and every photo simply joins the album.
insert into public.events (slug, name, description, sort_order, starts_at) values
  ('welcome',  'Welcome drinks',    'Friday evening in the old town',      10, '2027-05-14T19:00:00Z'),
  ('ceremony', 'The ceremony',      'Saturday afternoon in the garden',    20, '2027-05-15T16:00:00Z'),
  ('party',    'The party',         'Saturday night — dinner and dancing', 30, '2027-05-15T19:00:00Z'),
  ('brunch',   'The morning after', 'Sunday brunch, for the survivors',    40, '2027-05-16T11:00:00Z')
on conflict (slug) do nothing;
