import type { ExtraPhone } from '../lib/types';
import { phoneDisplay, phoneHref } from '../lib/format';

/** Highest confidence first — the main number is the most recently verified. */
function byScore(a: ExtraPhone, b: ExtraPhone): number {
  return (b.score ?? 0) - (a.score ?? 0);
}

function year(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : String(parsed.getFullYear());
}

export function OtherNumbers({ phones }: { phones: ExtraPhone[] | null }) {
  const list = Array.isArray(phones) ? phones.filter((entry) => entry?.phone) : [];
  // No empty state by design: with nothing to show, the section disappears.
  if (!list.length) return null;

  return (
    <div className="other-numbers">
      <p className="label-sm" style={{ marginBottom: 8 }}>
        Other numbers
      </p>
      <ul className="phone-list">
        {[...list].sort(byScore).map((entry, index) => {
          const parts = [entry.type, year(entry.last_seen)].filter(Boolean);
          return (
            <li key={`${entry.phone}-${index}`}>
              <a className="phone-link" href={phoneHref(entry.phone)}>
                {phoneDisplay(entry.phone)}
              </a>
              {parts.map((part) => (
                <span key={part as string}> · {part}</span>
              ))}
              {typeof entry.score === 'number' && <span> · score {entry.score}</span>}
              {entry.dnc === true && (
                <span className="phone-dnc" title="This number is on the federal Do Not Call list">
                  {' '}
                  · DNC
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-small" style={{ marginTop: 8 }}>
        Sorted by confidence. The main number is the most recently verified.
      </p>
    </div>
  );
}
