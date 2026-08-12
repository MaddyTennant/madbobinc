export function StatTile({
  label,
  value,
  sublabel,
  deltaText,
  deltaGood,
}: {
  label: string;
  value: string;
  sublabel?: string;
  deltaText?: string;
  deltaGood?: boolean;
}) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {sublabel ? <p className="mt-1 text-xs text-slate-500">{sublabel}</p> : null}
      {deltaText ? (
        <p className={`mt-1 text-xs font-medium ${deltaGood ? "text-emerald-600" : "text-red-600"}`}>{deltaText}</p>
      ) : null}
    </div>
  );
}
