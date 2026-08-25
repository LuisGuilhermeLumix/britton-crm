import { Checkbox } from './Checkbox';
import type { TagFilter } from '../lib/filters';

interface Props {
  value: TagFilter;
  onChange: (next: TagFilter) => void;
  /** Optional note rendered after the groups, e.g. "12 of 140 leads match". */
  hint?: string;
}

/**
 * Two labelled groups so the row doesn't read as one long strip of boxes.
 * The grouping is purely visual — every box is an independent AND filter.
 */
export function TagFilters({ value, onChange, hint }: Props) {
  const set = (patch: Partial<TagFilter>) => onChange({ ...value, ...patch });

  return (
    <div className="filter-group tag-filters">
      <div className="tag-group">
        <span className="group-label wide">Property</span>
        <div className="pill-row">
          <Checkbox label="Solar" checked={value.solar} onChange={(next) => set({ solar: next })} />
          <Checkbox label="Two-story" checked={value.twoStory} onChange={(next) => set({ twoStory: next })} />
        </div>
      </div>

      <span className="group-divider" aria-hidden="true" />

      <div className="tag-group">
        <span className="group-label wide">Compliance</span>
        <div className="pill-row">
          <Checkbox label="DNC" checked={value.dnc} onChange={(next) => set({ dnc: next })} />
          <Checkbox label="Litigator" checked={value.litigator} onChange={(next) => set({ litigator: next })} />
        </div>
      </div>

      {hint && <span className="text-small">{hint}</span>}
    </div>
  );
}
