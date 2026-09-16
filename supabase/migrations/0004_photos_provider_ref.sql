-- Both WhatsApp providers retry a webhook they think failed, and a retry after
-- a slow upload would otherwise post the same photograph twice. The provider's
-- own message id makes the insert idempotent.
alter table public.photos
  add column if not exists provider_ref text;

create unique index if not exists photos_provider_ref_key
  on public.photos (provider_ref)
  where provider_ref is not null;

-- A guest uploading from the web may now choose an event, but may not park a
-- photo in the pending state, attach somebody else's sender reference, or
-- squat on a provider message id.
drop policy if exists "anyone may contribute a photo" on public.photos;
create policy "anyone may contribute a photo"
  on public.photos for insert
  to anon, authenticated
  with check (
    hidden = false
    and featured = false
    and pending = false
    and sender_ref is null
    and provider_ref is null
    and sort_order = 0
    and source in ('web', 'whatsapp')
    and length(caption) <= 280
    and length(uploader) <= 80
    and storage_path like 'guest/%'
  );
