interface Props {
  title: string;
  value: string | number;
  help: string;
}

export function StatCard({ title, value, help }: Props) {
  return (
    <div className="stats-card">
      <p className="label-sm">{title}</p>
      <div className="number">{value}</div>
      <p className="help">{help}</p>
    </div>
  );
}
