import { useEffect, useState } from 'react';
import { qrDataUrl } from '@/lib/qr';

/**
 * A QR code rendered to a data URL at mount.
 *
 * Generated in the browser rather than fetched from a QR service, so the code
 * still works if that service disappears — and so no third party gets a log of
 * every guest who looked at the page.
 */
export function QrCode({
  value,
  size = 240,
  className,
  dark = '#231f1b',
  light = '#ffffff',
}: {
  value: string;
  size?: number;
  className?: string;
  dark?: string;
  light?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    qrDataUrl(value, size, dark, light)
      .then((url) => {
        if (!cancelled) {
          setDataUrl(url);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size, dark, light]);

  if (error) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
        role="img"
        aria-label="QR code unavailable"
      />
    );
  }

  return dataUrl ? (
    <img
      src={dataUrl}
      alt={`QR code linking to ${value}`}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size }}
    />
  ) : (
    <div className={className} style={{ width: size, height: size }} aria-hidden />
  );
}
