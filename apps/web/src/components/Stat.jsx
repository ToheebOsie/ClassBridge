/** A single headline figure with a caption. */
export function Stat({ value, label, note }) {
  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-card">
      <p className="num text-3xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-1 text-sm font-medium text-body">{label}</p>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
    </div>
  );
}
