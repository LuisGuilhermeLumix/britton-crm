import { useState } from 'react';

/**
 * The Lumix mark, served from public/logo-lumix.png so a missing file never
 * breaks the build. Falls back to a wordmark if the PNG isn't there yet.
 */
export function Brand({ height = 30 }: { height?: number }) {
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
