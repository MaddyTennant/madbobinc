export function Logo({ size = 32 }: { size?: number }) {
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-xl bg-brand-800 font-serif font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      R
    </div>
  );
}
