/**
 * Client-side gate for admin (inline content editing) mode.
 *
 * Like projectAuth, this is a soft gate — the password lives in the bundle, so
 * it is not a real security boundary (and saving still requires a GitHub token).
 * The unlocked state is kept in sessionStorage so admin mode persists as the
 * user navigates between pages for the rest of the tab session.
 *
 * Changes broadcast a window `admin-change` event so the app can re-render
 * without a navigation/hash change.
 */
const ADMIN_KEY = 'ac.admin.session';
const ADMIN_PASSWORD = '123';
const ADMIN_EVENT = 'admin-change';

export function isAdminUnlocked(): boolean {
  try {
    return sessionStorage.getItem(ADMIN_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Set the unlocked flag and notify listeners — but only on an actual change. */
function setUnlocked(): void {
  if (isAdminUnlocked()) return;
  try {
    sessionStorage.setItem(ADMIN_KEY, 'true');
  } catch {
    /* sessionStorage unavailable — admin lasts for this view only */
  }
  dispatch();
}

function dispatch(): void {
  try {
    window.dispatchEvent(new Event(ADMIN_EVENT));
  } catch {
    /* no window (SSR) */
  }
}

/** Returns true and unlocks admin mode when the password matches. */
export function tryUnlockAdmin(password: string): boolean {
  if (password === ADMIN_PASSWORD) {
    setUnlocked();
    return true;
  }
  return false;
}

/** Unlock without a password — used for the legacy `#/admin` / `?admin` URL flag. */
export function unlockAdminSession(): void {
  setUnlocked();
}

/** Exit admin mode and notify listeners. */
export function lockAdmin(): void {
  if (!isAdminUnlocked()) return;
  try {
    sessionStorage.removeItem(ADMIN_KEY);
  } catch {
    /* ignore */
  }
  dispatch();
}

export const ADMIN_CHANGE_EVENT = ADMIN_EVENT;
