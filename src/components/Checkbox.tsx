import { Check } from 'lucide-react';

interface Props {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

/** The pill-shaped checkbox from the demo. Independent, never mutually exclusive. */
export function Checkbox({ label, checked, onChange }: Props) {
  return (
    <label className={`check${checked ? ' on' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="box">
        <Check strokeWidth={3} aria-hidden="true" />
      </span>
      <span>{label}</span>
    </label>
  );
}
