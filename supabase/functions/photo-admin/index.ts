/**
 * Moderating guest photographs, and managing the events they are filed under.
 *
 * Hiding or deleting somebody else's photo is the one thing the website cannot
 * do from the browser: the anon key is only allowed to read and to insert, so
 * that a guest cannot quietly delete the photos they don't like the look of.
 * The same goes for events — a guest may read the list, but only the couple may
 * change it, because the WhatsApp picker is built from it.
 *
 * This function holds the service-role key and will only use it for a caller
 * who presents the shared secret.
 *
 * Set PHOTO_ADMIN_KEY in the project's edge function secrets. Until you do it
 * falls back to the site password, which is in the public bundle — fine for the
 * afternoon of the wedding, worth changing before the link goes out.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ADMIN_KEY = Deno.env.get('PHOTO_ADMIN_KEY') ?? '123';
const BUCKET = 'guest-photos';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(body: string, status = 200): Response {
  return new Response(body, { status, headers: { ...CORS, 'Content-Type': 'text/plain' } });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/** Compare in constant time, so the secret can't be recovered by timing. */
function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Events are addressed by slug in QR links, so keep them URL-safe. */
function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 39) || `event-${Date.now().toString(36).slice(-6)}`
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply('Method not allowed', 405);

  if (!secretsMatch(req.headers.get('x-admin-key') ?? '', ADMIN_KEY)) {
    return reply('Wrong moderation key.', 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return reply('Expected a JSON body.', 400);
  }

  const action = String(payload.action ?? '');
  const id = payload.id ? String(payload.id) : '';
  if (!action) return reply('An action is required.', 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  switch (action) {
    /* ── Photographs ─────────────────────────────────────────────────── */

    case 'hide':
    case 'restore': {
      if (!id) return reply('An id is required.', 400);
      const { error } = await supabase
        .from('photos')
        .update({ hidden: action === 'hide' })
        .eq('id', id);
      if (error) return reply(error.message, 500);
      return reply('ok');
    }

    case 'feature': {
      if (!id) return reply('An id is required.', 400);
      const { error } = await supabase
        .from('photos')
        .update({ featured: payload.featured ?? true })
        .eq('id', id);
      if (error) return reply(error.message, 500);
      return reply('ok');
    }

    /** File a photo under an event — including one still waiting for an answer. */
    case 'assign': {
      if (!id) return reply('An id is required.', 400);
      const eventId = payload.eventId ? String(payload.eventId) : null;
      const { error } = await supabase
        .from('photos')
        .update({ event_id: eventId, pending: false })
        .eq('id', id);
      if (error) return reply(error.message, 500);
      return reply('ok');
    }

    /**
     * Photos whose sender never said which event they were from. They are
     * invisible on the site, so this is the only way to find them.
     */
    case 'pending': {
      const { data, error } = await supabase
        .from('photos')
        .select('id, storage_path, caption, uploader, created_at')
        .eq('pending', true)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) return reply(error.message, 500);
      return json({ photos: data ?? [] });
    }

    case 'delete': {
      if (!id) return reply('An id is required.', 400);
      // Read the path first: once the row is gone there is no way to find the
      // object it pointed at, and an orphan in the bucket is billed forever.
      const { data, error: readError } = await supabase
        .from('photos')
        .select('storage_path')
        .eq('id', id)
        .single();
      if (readError) return reply(readError.message, 500);

      const { error: deleteError } = await supabase.from('photos').delete().eq('id', id);
      if (deleteError) return reply(deleteError.message, 500);

      if (data?.storage_path) {
        await supabase.storage.from(BUCKET).remove([data.storage_path]);
      }
      return reply('ok');
    }

    /* ── Events ──────────────────────────────────────────────────────── */

    case 'createEvent': {
      const name = String(payload.name ?? '').trim().slice(0, 24);
      if (!name) return reply('An event needs a name.', 400);
      const { data, error } = await supabase
        .from('events')
        .insert({
          name,
          slug: payload.slug ? slugify(String(payload.slug)) : slugify(name),
          description: String(payload.description ?? '').slice(0, 72),
          sort_order: Number(payload.sortOrder ?? 0),
          starts_at: payload.startsAt ? String(payload.startsAt) : null,
        })
        .select()
        .single();
      if (error) return reply(error.message, 500);
      return json({ event: data });
    }

    case 'updateEvent': {
      if (!id) return reply('An id is required.', 400);
      const patch: Record<string, unknown> = {};
      if (payload.name !== undefined) patch.name = String(payload.name).trim().slice(0, 24);
      if (payload.description !== undefined) patch.description = String(payload.description).slice(0, 72);
      if (payload.slug !== undefined) patch.slug = slugify(String(payload.slug));
      if (payload.sortOrder !== undefined) patch.sort_order = Number(payload.sortOrder);
      if (payload.startsAt !== undefined) patch.starts_at = payload.startsAt || null;
      if (payload.active !== undefined) patch.active = Boolean(payload.active);
      if (!Object.keys(patch).length) return reply('Nothing to change.', 400);

      const { error } = await supabase.from('events').update(patch).eq('id', id);
      if (error) return reply(error.message, 500);
      return reply('ok');
    }

    /** Reorder in one call, so dragging the list doesn't fire one per row. */
    case 'reorderEvents': {
      const order = Array.isArray(payload.order) ? (payload.order as string[]) : [];
      if (!order.length) return reply('An order is required.', 400);
      for (let i = 0; i < order.length; i++) {
        const { error } = await supabase
          .from('events')
          .update({ sort_order: (i + 1) * 10 })
          .eq('id', String(order[i]));
        if (error) return reply(error.message, 500);
      }
      return reply('ok');
    }

    case 'deleteEvent': {
      if (!id) return reply('An id is required.', 400);
      // Photographs outlive their event: the column is ON DELETE SET NULL, so
      // deleting "the ceremony" un-files its photos rather than destroying them.
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) return reply(error.message, 500);
      return reply('ok');
    }

    default:
      return reply(`Unknown action "${action}".`, 400);
  }
});
