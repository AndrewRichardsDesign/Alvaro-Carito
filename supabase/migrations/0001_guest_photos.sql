-- Guest photo wall for the wedding site.
--
-- Anyone (an unauthenticated guest arriving via the QR code, or the WhatsApp
-- webhook) may add a photo. Everyone may read the photos that have not been
-- hidden. Hiding, deleting and reordering are moderation actions and are NOT
-- granted to anon: they go through the `photo-admin` edge function, which
-- checks a shared secret and uses the service role.

create table if not exists public.photos (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  storage_path  text not null unique,
  caption       text not null default '',
  uploader      text not null default '',
  -- 'web' = QR / upload page, 'whatsapp' = inbound message, 'admin' = couple.
  source        text not null default 'web',
  width         integer,
  height        integer,
  -- Moderation + curation, writable only by the service role.
  hidden        boolean not null default false,
  featured      boolean not null default false,
  sort_order    integer not null default 0
);

comment on table public.photos is
  'Guest-contributed wedding photos. Rows are inserted by anon (QR upload page) or the WhatsApp webhook; moderation happens via the photo-admin edge function.';

create index if not exists photos_visible_idx
  on public.photos (hidden, sort_order desc, created_at desc);

alter table public.photos enable row level security;

drop policy if exists "photos are publicly readable" on public.photos;
create policy "photos are publicly readable"
  on public.photos for select
  to anon, authenticated
  using (hidden = false);

drop policy if exists "anyone may contribute a photo" on public.photos;
create policy "anyone may contribute a photo"
  on public.photos for insert
  to anon, authenticated
  with check (
    -- A guest may only ever add a plain, visible photo. Anything that
    -- privileges a row (featured / hidden / ordering) stays with the couple.
    hidden = false
    and featured = false
    and sort_order = 0
    and source in ('web', 'whatsapp')
    and length(caption) <= 280
    and length(uploader) <= 80
    and storage_path like 'guest/%'
  );

-- Storage ---------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'guest-photos',
  'guest-photos',
  true,
  26214400, -- 25 MB, comfortably above a modern phone photo
  array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "guest photos are publicly readable" on storage.objects;
create policy "guest photos are publicly readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'guest-photos');

drop policy if exists "anyone may upload a guest photo" on storage.objects;
create policy "anyone may upload a guest photo"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'guest-photos' and (storage.foldername(name))[1] = 'guest');
