/**
 * Where the guest-photo backend lives.
 *
 * These are *publishable* credentials — the anon key is designed to sit in a
 * browser bundle, and what it may do is bounded by the row-level security
 * policies in `supabase/migrations`. Nothing secret belongs in this file.
 * Both values can be overridden at build time with a `.env` if the site is
 * ever pointed at a different project.
 */
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://aipmyivogigxjexgnsys.supabase.co';

export const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_M5kcnR7ApoPiy3qqAAKl5g_he_bf-Wi';

/** Storage bucket holding everything guests send in. */
export const PHOTO_BUCKET = 'guest-photos';

/** Guests upload into this prefix; the RLS policies require it. */
export const GUEST_PREFIX = 'guest';

export const hasPhotoBackend = Boolean(SUPABASE_URL && SUPABASE_KEY);
