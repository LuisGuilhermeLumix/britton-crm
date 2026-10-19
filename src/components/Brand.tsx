import { useState } from 'react';

/**
 * The one place the Lumix mark is rendered — sidebar and login both use it,
 * only at different heights. Served from public/logo-lumix.png (also the
 * favicon). If the image ever fails to load, a plain wordmark shows instead
 * of a broken-image glyph.
 */
export function Brand({ height }: { height: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="brand" style={{ fontWeight: 600, fontSize: 16, letterSpacing: '-0.01em' }}>
        Lumix
      </div>
    );
  }

  return (
    <div className="brand">
      <img src="/logo-lumix.png" alt="Lumix" style={{ height }} onError={() => setFailed(true)} />
    </div>
  );
}
