/**
 * The moderation key for guest photos.
 *
 * Hiding or deleting a guest's photo is the one admin action that has to be
 * checked on the server — everything else in admin mode is just editing a file
 * the editor already needs a GitHub token to commit. This key is sent to the
 * `photo-admin` edge function, which compares it against its own secret. It
 * defaults to the site password so the feature works out of the box; set
 * PHOTO_ADMIN_KEY in the Supabase dashboard and change it here to something
 * that isn't in the bundle.
 */
const KEY = 'ac.photo.key';
const DEFAULT_KEY = '123';

export function getPhotoAdminKey(): string {
  try {
    return localStorage.getItem(KEY) ?? DEFAULT_KEY;
  } catch {
    return DEFAULT_KEY;
  }
}

export function setPhotoAdminKey(value: string): void {
  try {
    if (value) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
