/**
 * The two addresses a guest can be sent to in order to add photographs.
 *
 * Both can carry an event, which is the quiet trick that makes the whole
 * thing pleasant: a QR code printed for the welcome drinks already knows it is
 * the welcome drinks, so nobody is asked anything. The picker in WhatsApp is
 * the fallback for guests who arrive without scanning a code.
 */

/** The URL the QR code points at: the guest upload page. */
export function shareUrl(configured: string, eventSlug?: string): string {
  const base = configured.trim().replace(/#.*$/, '').replace(/\/+$/, '');
  const root =
    base ||
    (typeof window === 'undefined' ? '' : `${window.location.origin}${window.location.pathname}`);
  const query = eventSlug ? `?event=${encodeURIComponent(eventSlug)}` : '';
  return `${root}${base ? '/' : ''}#/share${query}`;
}

/**
 * A wa.me link that opens WhatsApp with the first message already written.
 *
 * The event rides along as a hashtag. It looks a little technical written
 * down, but no guest ever types it — it is pre-filled by the link behind the
 * QR code, and the webhook reads it off the first message.
 */
export function whatsappUrl(number: string, message: string, eventSlug?: string): string {
  const digits = number.replace(/\D/g, '');
  if (!digits) return '';
  const text = eventSlug ? `${message} #${eventSlug}` : message;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
