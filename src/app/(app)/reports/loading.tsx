import { ThinkingIndicator } from "@/components/ThinkingIndicator";

export default function ReportsLoading() {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <ThinkingIndicator label="Generating your report…" />
    </div>
  );
}
