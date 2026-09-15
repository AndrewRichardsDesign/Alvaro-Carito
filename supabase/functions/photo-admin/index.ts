/**
 * Moderating guest photographs.
 *
 * Hiding or deleting somebody else's photo is the one thing the website cannot
 * do from the browser: the anon key is only allowed to read and to insert, so
 * that a guest cannot quietly delete the photos they don't like the look of.
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

/** Compare in constant time, so the secret can't be recovered by timing. */
function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply('Method not allowed', 405);

  if (!secretsMatch(req.headers.get('x-admin-key') ?? '', ADMIN_KEY)) {
    return reply('Wrong moderation key.', 401);
  }

  let payload: { action?: string; id?: string; featured?: boolean };
  try {
    payload = await req.json();
  } catch {
    return reply('Expected a JSON body.', 400);
  }

  const { action, id } = payload;
  if (!action || !id) return reply('Both action and id are required.', 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  switch (action) {
    case 'hide':
    case 'restore': {
      const { error } = await supabase
        .from('photos')
        .update({ hidden: action === 'hide' })
        .eq('id', id);
      if (error) return reply(error.message, 500);
      return reply('ok');
    }

    case 'feature': {
      const { error } = await supabase
        .from('photos')
        .update({ featured: payload.featured ?? true })
        .eq('id', id);
      if (error) return reply(error.message, 500);
      return reply('ok');
    }

    case 'delete': {
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

    default:
      return reply(`Unknown action "${action}".`, 400);
  }
});
