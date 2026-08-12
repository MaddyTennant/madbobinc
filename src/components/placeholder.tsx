export function ComingSoon({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-stone-900">{title}</h1>
      <p className="mt-2 text-sm text-stone-500">This module is being built next.</p>
    </div>
  );
}
