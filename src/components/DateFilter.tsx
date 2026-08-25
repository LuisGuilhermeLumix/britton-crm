import { useState } from 'react';
import { DATE_FILTERS, type DateFilterKey } from '../lib/constants';
import type { CustomRange } from '../lib/filters';
import { addDays, parseYMD, shortDate, ymd } from '../lib/format';

export interface DateFilterValue {
  key: DateFilterKey;
  custom: CustomRange;
}

export function defaultDateFilter(key: DateFilterKey = '30'): DateFilterValue {
  return {
    key,
    custom: { start: ymd(addDays(new Date(), -14)), end: ymd(new Date()) },
  };
}

interface Props {
  value: DateFilterValue;
  onChange: (next: DateFilterValue) => void;
}

/**
 * Date pills plus the custom two-date panel. Shared by Dashboard and Pipeline,
 * which each hold their own value — the two filters are independent.
 */
export function DateFilter({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CustomRange>(value.custom);
  const [error, setError] = useState('');

  /** Reaching 'custom' requires Apply, so the key alone proves it was applied. */
  function pillLabel(key: DateFilterKey, label: string): string {
    if (key !== 'custom') return label;
    if (value.key === 'custom') {
      const start = parseYMD(value.custom.start);
      const end = parseYMD(value.custom.end);
      if (start && end) return `${shortDate(start)} – ${shortDate(end)}`;
    }
    return 'Custom';
  }

  function apply() {
    const start = parseYMD(draft.start);
    const end = parseYMD(draft.end);
    if (!start || !end) {
      setError('Pick both dates.');
      return;
    }
    if (start > end) {
      setError('Start date must come first.');
      return;
    }
    setError('');
    setOpen(false);
    onChange({ key: 'custom', custom: draft });
  }

  return (
    <>
      <div className="filter-group">
        <span className="group-label wide">Date</span>
        <div className="pill-row">
          {DATE_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={`pill${value.key === filter.key ? ' active' : ''}`}
              onClick={() => {
                if (filter.key === 'custom') {
                  setOpen((current) => !current || value.key !== 'custom');
                  setError('');
                  return;
                }
                setOpen(false);
                onChange({ ...value, key: filter.key });
              }}
            >
              {pillLabel(filter.key, filter.label)}
            </button>
          ))}
        </div>
      </div>

      {open && (
        <div className="custom-panel">
          <div className="date-field">
            <label htmlFor="custom-start">From</label>
            <input
              id="custom-start"
              type="date"
              value={draft.start}
              onChange={(event) => setDraft((current) => ({ ...current, start: event.target.value }))}
            />
          </div>
          <div className="date-field">
            <label htmlFor="custom-end">To</label>
            <input
              id="custom-end"
              type="date"
              value={draft.end}
              onChange={(event) => setDraft((current) => ({ ...current, end: event.target.value }))}
            />
          </div>
          <button type="button" className="btn-secondary" onClick={apply}>
            Apply
          </button>
          {error && <span className="custom-error">{error}</span>}
        </div>
      )}
    </>
  );
}
