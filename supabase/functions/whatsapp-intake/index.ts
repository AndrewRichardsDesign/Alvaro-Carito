/**
 * Photographs by WhatsApp.
 *
 * A guest sends a picture to the couple's WhatsApp number and it appears on the
 * website — no QR code, no upload page, nothing to explain to anybody's aunt.
 *
 * One function handles both routes to WhatsApp, because which one you can use
 * depends on paperwork rather than code:
 *
 *  - Meta's WhatsApp Cloud API talks to a business number you own. Messages a
 *    guest starts are free, but it needs a verified Meta Business account.
 *  - Twilio's sandbox works in about five minutes with no verification, at a
 *    few cents a message, and guests have to join the sandbox with a code once.
 *
 * Set the credentials for whichever you have and this starts working; set both
 * and both work. The shape of the incoming request is what tells them apart.
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

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

interface Incoming {
  bytes: Uint8Array;
  contentType: string;
  uploader: string;
  caption: string;
}

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

/* ── Storing ────────────────────────────────────────────────────────────── */

function extensionFor(contentType: string): string {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  return 'jpg';
}

async function store(photo: Incoming): Promise<void> {
  if (!photo.bytes.length || photo.bytes.length > MAX_BYTES) return;

  const path = `guest/${crypto.randomUUID()}.${extensionFor(photo.contentType)}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, photo.bytes, { contentType: photo.contentType, cacheControl: '31536000' });
  if (uploadError) {
    console.error('upload failed', uploadError.message);
    return;
  }

  const { error } = await supabase.from('photos').insert({
    storage_path: path,
    caption: photo.caption.slice(0, 280),
    uploader: photo.uploader.slice(0, 80),
    source: 'whatsapp',
  });
  if (error) {
    console.error('insert failed', error.message);
    await supabase.storage.from(BUCKET).remove([path]);
  }
}

/* ── Meta WhatsApp Cloud API ────────────────────────────────────────────── */

interface MetaMessage {
  from?: string;
  type?: string;
  image?: { id?: string; caption?: string };
  document?: { id?: string; mime_type?: string; caption?: string };
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
      const contacts = (value.contacts ?? []) as { profile?: { name?: string }; wa_id?: string }[];
      const messages = (value.messages ?? []) as MetaMessage[];

      for (const message of messages) {
        // Photos sent as a "document" keep their full resolution, so accept both.
        const media =
          message.type === 'image'
            ? message.image
            : message.type === 'document' && message.document?.mime_type?.startsWith('image/')
              ? message.document
              : null;
        if (!media?.id) continue;

        const name = contacts[0]?.profile?.name ?? '';
        const caption = message.image?.caption ?? message.document?.caption ?? '';

        // Media arrives as an id: ask the Graph API where it lives, then fetch
        // it with the same bearer token.
        const lookup = await fetch(`${GRAPH}/${media.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!lookup.ok) {
          console.error('media lookup failed', lookup.status);
          continue;
        }
        const { url, mime_type } = (await lookup.json()) as { url?: string; mime_type?: string };
        if (!url) continue;

        const download = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!download.ok) {
          console.error('media download failed', download.status);
          continue;
        }

        await store({
          bytes: new Uint8Array(await download.arrayBuffer()),
          contentType: mime_type ?? 'image/jpeg',
          uploader: name,
          caption,
        });
      }
    }
  }
}

/* ── Twilio ─────────────────────────────────────────────────────────────── */

async function handleTwilio(params: URLSearchParams): Promise<void> {
  const count = Number(params.get('NumMedia') ?? '0');
  if (!count) return;

  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const name = params.get('ProfileName') ?? '';
  const caption = params.get('Body') ?? '';

  for (let i = 0; i < count; i++) {
    const url = params.get(`MediaUrl${i}`);
    const contentType = params.get(`MediaContentType${i}`) ?? 'image/jpeg';
    if (!url || !contentType.startsWith('image/')) continue;

    // Twilio's media URLs need the account credentials.
    const headers: HeadersInit =
      sid && authToken ? { Authorization: `Basic ${btoa(`${sid}:${authToken}`)}` } : {};
    const download = await fetch(url, { headers, redirect: 'follow' });
    if (!download.ok) {
      console.error('twilio media download failed', download.status);
      continue;
    }

    await store({
      bytes: new Uint8Array(await download.arrayBuffer()),
      contentType,
      uploader: name,
      // Only the first photo of a batch carries the message text.
      caption: i === 0 ? caption : '',
    });
  }
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
      await handleTwilio(params);
    }
  } catch (e) {
    // Never fail the webhook: both providers retry on an error, and a retry
    // storm would post the same photograph over and over.
    console.error('intake failed', e);
  }

  // Twilio reads the response body as TwiML; an empty document means
  // "received, say nothing back".
  return new Response('<Response></Response>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
});
