import { requireValidSession } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { techOnlyMode } from "@/lib/flags";
import { logoutAction } from "../../(auth)/actions";
import { createWorkspaceAction } from "./actions";
import { OnboardingCard } from "./OnboardingCard";

export default async function NewWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireValidSession();
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-3 flex items-center gap-2">
          <Logo />
        </div>

        <OnboardingCard techOnlyMode={techOnlyMode()} action={createWorkspaceAction} error={error} />

        <form action={logoutAction} className="mt-4 text-center">
          <button className="text-xs font-medium text-stone-400 hover:text-stone-600" type="submit">
            Not you? Log out
          </button>
        </form>
      </div>
    </div>
  );
}
