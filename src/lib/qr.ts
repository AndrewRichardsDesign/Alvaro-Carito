import QRCode from 'qrcode';
import { saveBlob } from './zip';

/**
 * QR codes are generated in the browser rather than fetched from a QR service,
 * so they still work if that service disappears — and so no third party gets a
 * log of every guest who looked at the page.
 */
export function qrDataUrl(value: string, size = 240, dark = '#231f1b', light = '#ffffff'): Promise<string> {
  return QRCode.toDataURL(value, {
    // 2× so it stays crisp on a retina screen and, more to the point, in print.
    width: size * 2,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark, light },
  });
}

/** Save a QR code as a PNG, big enough to print on a table card. */
export async function downloadQr(value: string, filename: string): Promise<void> {
  const url = await qrDataUrl(value, 600);
  const res = await fetch(url);
  saveBlob(await res.blob(), filename);
}
