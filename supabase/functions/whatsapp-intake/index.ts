/**
 * Photographs by WhatsApp, filed under the right event.
 *
 * A wedding is rarely one event — welcome drinks, the ceremony, the party, the
 * brunch the morning after — so a photograph needs to say which one it belongs
 * to. Asking is harder than it sounds, because people send photos first and
 * read messages second. Three things make it work:
 *
 *  1. Most of the time nobody is asked at all. The QR code on each table opens
 *     WhatsApp with that event's hashtag already typed, so the very first
 *     message identifies itself.
 *  2. Otherwise we ask once, with a native picker — an interactive list on
 *     Meta, where the guest taps the event rather than typing anything.
 *  3. Photos that arrive *before* the question is answered are held back,
 *     invisible, and filed retroactively the moment the guest picks. Nothing
 *     lands in the wrong album, and nothing is lost.
 *
 * The choice then sticks for a few hours, so somebody sending forty photos is
 * asked once rather than forty times.
 *
 * Twilio takes the same path but answers with a numbered list: its interactive
 * messages need pre-registered Content templates, which cannot track events the
 * couple edits from the website. A plain "reply 1" works everywhere, including
 * the sandbox, which is where this gets tested first.
 *
 * Secrets (Supabase dashboard → Edge Functions → Secrets):
 *   WHATSAPP_VERIFY_TOKEN  any string you also type into Meta's webhook setup
 *   WHATSAPP_TOKEN         Meta permanent access token
 *   WHATSAPP_APP_SECRET    Meta app secret — enables signature checking
 *   TWILIO_ACCOUNT_SID     Twilio account SID
 *   TWILIO_AUTH_TOKEN      Twilio auth token — also used to verify signatures
 *   WHATSAPP_PUBLIC_URL    this function's own URL, needed to check Twilio's
 *                          signature when it sits behind a proxy
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { encodeHex } from 'jsr:@std/encoding@1/hex';

const BUCKET = 'guest-photos';
const GRAPH = 'https://graph.facebook.com/v21.0';
const MAX_BYTES = 25 * 1024 * 1024;

/** How long a guest's choice of event is remembered between messages. */
const CHOICE_TTL_HOURS = 6;
/** Never re-send the picker to the same person inside this window. */
const REASK_COOLDOWN_MINUTES = 10;
/** WhatsApp interactive lists cap out here; beyond it we fall back to text. */
const MAX_LIST_ROWS = 10;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

interface EventRow {
  id: string;
  slug: string;
  name: string;
  description: string;
}

interface SenderRow {
  sender_ref: string;
  event_id: string | null;
  choice_expires_at: string | null;
  awaiting_choice: boolean;
  asked_at: string | null;
}

interface Incoming {
  bytes: Uint8Array;
  contentType: string;
  caption: string;
  /** Unique per photo, so a webhook retry cannot post it twice. */
  providerRef: string;
}

/** What we want said back to the guest, if anything. */
type Outbound =
  | { kind: 'none' }
  | { kind: 'text'; text: string }
  | { kind: 'picker'; prompt: string; events: EventRow[] };

/* ── Signature checking ─────────────────────────────────────────────────── */

async function hmac(algorithm: 'SHA-256' | 'SHA-1', secret: string, message: Uint8Array) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, message));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Meta signs the raw body with the app secret. */
async function metaSignatureValid(header: string | null, body: Uint8Array): Promise<boolean> {
  const secret = Deno.env.get('WHATSAPP_APP_SECRET');
  if (!secret) return true; // not configured — nothing to check against
  if (!header?.startsWith('sha256=')) return false;
  const expected = encodeHex(await hmac('SHA-256', secret, body));
  return timingSafeEqual(header.slice(7).toLowerCase(), expected);
}

/** Twilio signs the URL followed by its sorted form parameters. */
async function twilioSignatureValid(
  header: string | null,
  url: string,
  params: URLSearchParams
): Promise<boolean> {
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  if (!token) return true;
  if (!header) return false;
  const keys = [...new Set([...params.keys()])].sort();
  const payload = url + keys.map((k) => k + params.get(k)).join('');
  const digest = await hmac('SHA-1', token, new TextEncoder().encode(payload));
  return timingSafeEqual(header, btoa(String.fromCharCode(...digest)));
}

/* ── Events and sender state ────────────────────────────────────────────── */

async function loadEvents(): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id, slug, name, description')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('starts_at', { ascending: true });
  if (error) {
    console.error('could not load events', error.message);
    return [];
  }
  return (data ?? []) as EventRow[];
}

async function loadSender(ref: string, displayName: string): Promise<SenderRow> {
  const { data } = await supabase
    .from('whatsapp_senders')
    .upsert(
      { sender_ref: ref, display_name: displayName, updated_at: new Date().toISOString() },
      { onConflict: 'sender_ref', ignoreDuplicates: false }
    )
    .select('sender_ref, event_id, choice_expires_at, awaiting_choice, asked_at')
    .single();
  return (
    (data as SenderRow | null) ?? {
      sender_ref: ref,
      event_id: null,
      choice_expires_at: null,
      awaiting_choice: false,
      asked_at: null,
    }
  );
}

/** The remembered choice, if it hasn't gone stale. */
function rememberedEvent(sender: SenderRow, events: EventRow[]): EventRow | null {
  if (!sender.event_id) return null;
  if (sender.choice_expires_at && new Date(sender.choice_expires_at) < new Date()) return null;
  return events.find((e) => e.id === sender.event_id) ?? null;
}

async function rememberChoice(ref: string, eventId: string): Promise<void> {
  const expires = new Date(Date.now() + CHOICE_TTL_HOURS * 3600_000).toISOString();
  await supabase
    .from('whatsapp_senders')
    .update({
      event_id: eventId,
      choice_expires_at: expires,
      awaiting_choice: false,
      updated_at: new Date().toISOString(),
    })
    .eq('sender_ref', ref);
}

/**
 * Claim the right to ask this person. The filters run inside the UPDATE, and
 * an UPDATE takes a row lock, so when twenty photos arrive at once exactly one
 * of them wins the claim and the guest gets one question instead of twenty.
 */
async function claimTheAsk(ref: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - REASK_COOLDOWN_MINUTES * 60_000).toISOString();
  const { data } = await supabase
    .from('whatsapp_senders')
    .update({ awaiting_choice: true, asked_at: new Date().toISOString() })
    .eq('sender_ref', ref)
    .or(`awaiting_choice.is.false,asked_at.lt.${cutoff}`)
    .select('sender_ref');
  return (data?.length ?? 0) > 0;
}

/** File everything this sender left waiting on an answer. */
async function backfillPending(ref: string, eventId: string): Promise<number> {
  const { data, error } = await supabase
    .from('photos')
    .update({ event_id: eventId, pending: false })
    .eq('sender_ref', ref)
    .eq('pending', true)
    .select('id');
  if (error) {
    console.error('back-fill failed', error.message);
    return 0;
  }
  return data?.length ?? 0;
}

/* ── Reading the guest's answer ─────────────────────────────────────────── */

const RESET_WORDS = ['change', 'menu', 'events', 'event', 'switch', 'other', 'wrong'];

/**
 * Work out which event a message is about, from the most explicit signal to
 * the least: a tapped list row, then a hashtag from a QR deep link, then a
 * number from the text fallback, then the event's name typed out.
 */
function detectChoice(text: string, interactiveId: string | null, events: EventRow[]): EventRow | null {
  if (interactiveId) {
    const byId = events.find((e) => e.id === interactiveId || `event:${e.id}` === interactiveId);
    if (byId) return byId;
    // Twilio echoes the payload we set, which is the slug.
    const bySlug = events.find((e) => e.slug === interactiveId);
    if (bySlug) return bySlug;
  }

  const trimmed = text.trim();
  if (!trimmed) return null;

  const hashtag = trimmed.toLowerCase().match(/#([a-z0-9][a-z0-9-]{0,38})/);
  if (hashtag) {
    const bySlug = events.find((e) => e.slug === hashtag[1]);
    if (bySlug) return bySlug;
  }

  // A bare number, answering the numbered fallback list.
  const number = trimmed.match(/^\s*(\d{1,2})[.)]?\s*$/);
  if (number) {
    const index = Number(number[1]) - 1;
    if (index >= 0 && index < events.length) return events[index];
  }

  // The event's name, typed or pasted. Only whole-name matches: a photo
  // captioned "the party was wonderful" should not silently re-file itself.
  const lower = trimmed.toLowerCase();
  return events.find((e) => lower === e.name.toLowerCase() || lower === e.slug) ?? null;
}

function wantsToChange(text: string): boolean {
  const lower = text.trim().toLowerCase().replace(/[^a-z ]/g, '');
  return RESET_WORDS.includes(lower);
}

function numberedList(events: EventRow[]): string {
  return events.map((e, i) => `${i + 1}. ${e.name}`).join('\n');
}

/* ── Storing ────────────────────────────────────────────────────────────── */

function extensionFor(contentType: string): string {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  return 'jpg';
}

async function store(
  photo: Incoming,
  sender: { ref: string; name: string },
  eventId: string | null
): Promise<'stored' | 'pending' | 'skipped'> {
  if (!photo.bytes.length || photo.bytes.length > MAX_BYTES) return 'skipped';

  // A webhook retry would otherwise re-upload the same photograph.
  const { data: existing } = await supabase
    .from('photos')
    .select('id')
    .eq('provider_ref', photo.providerRef)
    .maybeSingle();
  if (existing) return 'skipped';

  const path = `guest/${crypto.randomUUID()}.${extensionFor(photo.contentType)}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, photo.bytes, { contentType: photo.contentType, cacheControl: '31536000' });
  if (uploadError) {
    console.error('upload failed', uploadError.message);
    return 'skipped';
  }

  const pending = eventId === null;
  const { error } = await supabase.from('photos').insert({
    storage_path: path,
    caption: photo.caption.slice(0, 280),
    uploader: sender.name.slice(0, 80),
    source: 'whatsapp',
    event_id: eventId,
    pending,
    sender_ref: sender.ref,
    provider_ref: photo.providerRef,
  });
  if (error) {
    console.error('insert failed', error.message);
    await supabase.storage.from(BUCKET).remove([path]);
    return 'skipped';
  }
  return pending ? 'pending' : 'stored';
}

/* ── The conversation ───────────────────────────────────────────────────── */

/**
 * The whole decision, shared by both providers: take what arrived, work out
 * the event, store the photographs, and say what (if anything) to reply.
 */
async function handleMessage(input: {
  senderRef: string;
  senderName: string;
  text: string;
  interactiveId: string | null;
  media: Incoming[];
}): Promise<Outbound> {
  const events = await loadEvents();

  // No events configured: this is a single-occasion wedding, so never ask.
  if (events.length === 0) {
    for (const photo of input.media) {
      await store(photo, { ref: input.senderRef, name: input.senderName }, null);
      // With no events at all, "no event" is the normal state, not a pending one.
      await supabase
        .from('photos')
        .update({ pending: false })
        .eq('provider_ref', photo.providerRef);
    }
    return { kind: 'none' };
  }

  const sender = await loadSender(input.senderRef, input.senderName);
  const chosen = detectChoice(input.text, input.interactiveId, events);
  const asking = wantsToChange(input.text);

  // A single event needs no picker — everything belongs to it.
  const only = events.length === 1 ? events[0] : null;
  const active = chosen ?? only ?? (asking ? null : rememberedEvent(sender, events));

  if (chosen) {
    await rememberChoice(input.senderRef, chosen.id);
  }

  let stored = 0;
  let held = 0;
  for (const photo of input.media) {
    const result = await store(photo, { ref: input.senderRef, name: input.senderName }, active?.id ?? null);
    if (result === 'stored') stored++;
    if (result === 'pending') held++;
  }

  if (active) {
    // Anything this person sent before answering can now be filed.
    const backfilled = chosen ? await backfillPending(input.senderRef, active.id) : 0;
    if (chosen) {
      const total = backfilled + stored;
      return {
        kind: 'text',
        text: total
          ? `Thank you — ${total} photograph${total === 1 ? '' : 's'} filed under ${active.name}. Keep them coming, we'll keep them here.`
          : `${active.name} it is. Send your photographs whenever you like — say “change” if you need a different one.`,
      };
    }
    // Already knew the event: file silently rather than reply to every photo.
    return { kind: 'none' };
  }

  // We need an answer. Ask once, however many photos just landed.
  if (!(await claimTheAsk(input.senderRef))) return { kind: 'none' };

  const prompt = held
    ? `Thank you! We're holding ${held === 1 ? 'that photograph' : `those ${held} photographs`} — which part of the weekend ${held === 1 ? 'is it' : 'are they'} from?`
    : 'Lovely to hear from you! Which part of the weekend are your photographs from?';

  return { kind: 'picker', prompt, events };
}

/* ── Meta WhatsApp Cloud API ────────────────────────────────────────────── */

interface MetaMessage {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; caption?: string };
  document?: { id?: string; mime_type?: string; caption?: string };
  interactive?: {
    type?: string;
    list_reply?: { id?: string };
    button_reply?: { id?: string };
  };
}

async function metaSend(phoneNumberId: string, to: string, body: Record<string, unknown>): Promise<void> {
  const token = Deno.env.get('WHATSAPP_TOKEN');
  if (!token) return;
  const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, ...body }),
  });
  if (!res.ok) console.error('send failed', res.status, await res.text());
}

async function metaReply(phoneNumberId: string, to: string, out: Outbound): Promise<void> {
  if (out.kind === 'none') return;

  if (out.kind === 'text') {
    await metaSend(phoneNumberId, to, { type: 'text', text: { body: out.text } });
    return;
  }

  // More events than a list can hold: ask in plain text instead of silently
  // truncating the choices.
  if (out.events.length > MAX_LIST_ROWS) {
    await metaSend(phoneNumberId, to, {
      type: 'text',
      text: { body: `${out.prompt}\n\n${numberedList(out.events)}\n\nReply with a number.` },
    });
    return;
  }

  await metaSend(phoneNumberId, to, {
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: out.prompt.slice(0, 1024) },
      footer: { text: 'You can change this later by sending “change”.' },
      action: {
        button: 'Choose an event',
        sections: [
          {
            title: 'The weekend',
            rows: out.events.map((e) => ({
              id: `event:${e.id}`,
              title: e.name.slice(0, 24),
              description: e.description.slice(0, 72),
            })),
          },
        ],
      },
    },
  });
}

async function handleMeta(body: unknown): Promise<void> {
  const token = Deno.env.get('WHATSAPP_TOKEN');
  if (!token) {
    console.error('A Meta webhook arrived but WHATSAPP_TOKEN is not set.');
    return;
  }

  const entries = (body as { entry?: unknown[] }).entry ?? [];
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] }).changes ?? [];
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> }).value ?? {};
      const metadata = (value.metadata ?? {}) as { phone_number_id?: string };
      const contacts = (value.contacts ?? []) as { profile?: { name?: string } }[];
      const messages = (value.messages ?? []) as MetaMessage[];
      const phoneNumberId = metadata.phone_number_id;
      const senderName = contacts[0]?.profile?.name ?? '';

      for (const message of messages) {
        const senderRef = message.from;
        if (!senderRef) continue;

        // Photos sent as a "document" keep their full resolution, so take both.
        const media =
          message.type === 'image'
            ? message.image
            : message.type === 'document' && message.document?.mime_type?.startsWith('image/')
              ? message.document
              : null;

        const incoming: Incoming[] = [];
        if (media?.id) {
          const downloaded = await downloadMetaMedia(media.id, token);
          if (downloaded) {
            incoming.push({
              ...downloaded,
              caption: message.image?.caption ?? message.document?.caption ?? '',
              providerRef: `meta:${message.id ?? media.id}`,
            });
          }
        }

        const out = await handleMessage({
          senderRef,
          senderName,
          text: message.text?.body ?? '',
          interactiveId:
            message.interactive?.list_reply?.id ?? message.interactive?.button_reply?.id ?? null,
          media: incoming,
        });

        if (phoneNumberId) await metaReply(phoneNumberId, senderRef, out);
      }
    }
  }
}

/** Media arrives as an id: ask where it lives, then fetch it with the token. */
async function downloadMetaMedia(
  mediaId: string,
  token: string
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const lookup = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!lookup.ok) {
    console.error('media lookup failed', lookup.status);
    return null;
  }
  const { url, mime_type } = (await lookup.json()) as { url?: string; mime_type?: string };
  if (!url) return null;

  const download = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!download.ok) {
    console.error('media download failed', download.status);
    return null;
  }
  return {
    bytes: new Uint8Array(await download.arrayBuffer()),
    contentType: mime_type ?? 'image/jpeg',
  };
}

/* ── Twilio ─────────────────────────────────────────────────────────────── */

function twiml(text?: string): Response {
  const body = text
    ? `<Response><Message>${text.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!))}</Message></Response>`
    : '<Response></Response>';
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/xml' } });
}

async function handleTwilio(params: URLSearchParams): Promise<Response> {
  const count = Number(params.get('NumMedia') ?? '0');
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const senderRef = params.get('From') ?? '';
  if (!senderRef) return twiml();

  const media: Incoming[] = [];
  for (let i = 0; i < count; i++) {
    const url = params.get(`MediaUrl${i}`);
    const contentType = params.get(`MediaContentType${i}`) ?? 'image/jpeg';
    if (!url || !contentType.startsWith('image/')) continue;

    const headers: HeadersInit =
      sid && authToken ? { Authorization: `Basic ${btoa(`${sid}:${authToken}`)}` } : {};
    const download = await fetch(url, { headers, redirect: 'follow' });
    if (!download.ok) {
      console.error('twilio media download failed', download.status);
      continue;
    }
    media.push({
      bytes: new Uint8Array(await download.arrayBuffer()),
      contentType,
      // Only the first photo of a batch carries the message text.
      caption: i === 0 ? params.get('Body') ?? '' : '',
      providerRef: `twilio:${params.get('MessageSid') ?? crypto.randomUUID()}:${i}`,
    });
  }

  const out = await handleMessage({
    senderRef,
    senderName: params.get('ProfileName') ?? '',
    text: params.get('Body') ?? '',
    // Quick replies and list rows both come back as ButtonPayload.
    interactiveId: params.get('ButtonPayload') ?? null,
    media,
  });

  if (out.kind === 'text') return twiml(out.text);
  if (out.kind === 'picker') {
    return twiml(`${out.prompt}\n\n${numberedList(out.events)}\n\nReply with a number.`);
  }
  return twiml();
}

/* ── Entry point ────────────────────────────────────────────────────────── */

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // Meta verifies a new webhook with a GET challenge.
  if (req.method === 'GET') {
    const verify = Deno.env.get('WHATSAPP_VERIFY_TOKEN');
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge') ?? '';
    if (mode === 'subscribe' && verify && token === verify) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('Verification failed', { status: 403 });
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const raw = new Uint8Array(await req.arrayBuffer());
  const contentType = req.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('application/json')) {
      if (!(await metaSignatureValid(req.headers.get('x-hub-signature-256'), raw))) {
        return new Response('Bad signature', { status: 401 });
      }
      await handleMeta(JSON.parse(new TextDecoder().decode(raw)));
    } else {
      const params = new URLSearchParams(new TextDecoder().decode(raw));
      const publicUrl = Deno.env.get('WHATSAPP_PUBLIC_URL') ?? url.toString();
      if (!(await twilioSignatureValid(req.headers.get('x-twilio-signature'), publicUrl, params))) {
        return new Response('Bad signature', { status: 401 });
      }
      return await handleTwilio(params);
    }
  } catch (e) {
    // Never fail the webhook: both providers retry on an error, and a retry
    // storm would ask the same guest the same question over and over.
    console.error('intake failed', e);
  }

  return twiml();
});
