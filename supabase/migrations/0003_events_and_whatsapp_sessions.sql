-- Which event is a photograph from?
--
-- A wedding is rarely one event: welcome drinks, the ceremony, the party, the
-- brunch the morning after. Guests sending photographs on WhatsApp need to say
-- which one they mean, and the answer has to survive between messages —
-- nobody wants to be asked again for every photo.

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  -- Short, URL- and hashtag-safe. Used in wa.me deep links: "#ceremony".
  slug        text not null unique
              check (slug ~ '^[a-z0-9][a-z0-9-]{0,38}$'),
  -- WhatsApp list rows cap the title at 24 characters and the description
  -- at 72, so the picker cannot render anything longer than this.
  name        text not null check (length(name) between 1 and 24),
  description text not null default '' check (length(description) <= 72),
  starts_at   timestamptz,
  sort_order  integer not null default 0,
  -- Past events can be retired without losing their photographs.
  active      boolean not null default true
);

comment on table public.events is
  'The separate occasions guests can attribute photographs to. Order in the WhatsApp picker follows sort_order, then starts_at.';

create index if not exists events_active_idx on public.events (active, sort_order, starts_at);

alter table public.events enable row level security;

drop policy if exists "events are publicly readable" on public.events;
create policy "events are publicly readable"
  on public.events for select
  to anon, authenticated
  using (true);
-- No insert/update/delete policy: events are managed through the photo-admin
-- edge function, which holds the service role behind a shared secret.

-- Photos gain an event, and the notion of not having one yet -------------

alter table public.photos
  add column if not exists event_id uuid references public.events (id) on delete set null;

-- A photo that arrived before its sender told us which event it belongs to.
-- It is deliberately invisible on the site until the question is answered, so
-- nothing lands in the wrong album — or in no album — in front of guests.
alter table public.photos
  add column if not exists pending boolean not null default false;

-- The sender's WhatsApp id, so their answer can be matched to photos they
-- have already sent. Never shown on the site.
alter table public.photos
  add column if not exists sender_ref text;

create index if not exists photos_event_idx on public.photos (event_id, created_at desc);
create index if not exists photos_pending_idx on public.photos (sender_ref, pending) where pending;

-- Visibility now also excludes photos still waiting for an event.
drop policy if exists "photos are publicly readable" on public.photos;
create policy "photos are publicly readable"
  on public.photos for select
  to anon, authenticated
  using (hidden = false and pending = false);

-- WhatsApp conversation state -------------------------------------------

-- One row per person who has ever sent us a photograph. Remembers which event
-- they last chose so a guest sending forty photos is asked once, not forty
-- times. Not readable by anon at all: it is a list of guests' phone numbers.
create table if not exists public.whatsapp_senders (
  -- The provider's id for the sender (a phone number, effectively).
  sender_ref     text primary key,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  display_name   text not null default '',
  event_id       uuid references public.events (id) on delete set null,
  -- When the remembered choice goes stale and we ask again.
  choice_expires_at timestamptz,
  -- True while we have sent the picker and are waiting for an answer, so we
  -- don't send it again on every photo in a burst.
  awaiting_choice boolean not null default false,
  asked_at       timestamptz
);

comment on table public.whatsapp_senders is
  'Per-sender WhatsApp conversation state. Contains phone numbers, so it is readable only by the service role.';

alter table public.whatsapp_senders enable row level security;
-- Intentionally no policies: only the service role touches this table.
