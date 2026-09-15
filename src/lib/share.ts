/**
 * The two addresses a guest can be sent to in order to add photographs.
 */

/** The URL the QR code points at: the guest upload page. */
export function shareUrl(configured: string): string {
  const base = configured.trim().replace(/#.*$/, '').replace(/\/+$/, '');
  if (base) return `${base}/#/share`;
  if (typeof window === 'undefined') return '#/share';
  return `${window.location.origin}${window.location.pathname}#/share`;
}

/** A wa.me link that opens WhatsApp with the first message already written. */
export function whatsappUrl(number: string, message: string): string {
  const digits = number.replace(/\D/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
