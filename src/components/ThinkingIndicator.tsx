import { SparkleIcon } from "@/components/icons";

export function ThinkingIndicator({ label = "Thinking…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6">
      <SparkleIcon className="h-6 w-6 animate-spin text-brand-600" />
      <p className="text-sm text-stone-500">{label}</p>
    </div>
  );
}
