import { requireValidSession } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { logoutAction } from "../../(auth)/actions";
import { createWorkspaceAction } from "./actions";

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
        <h1 className="mb-1 text-2xl font-semibold text-stone-900">Set up your venue</h1>
        <p className="mb-6 text-sm text-stone-500">
          This creates a private workspace — all connected data and AI insights stay inside it.
        </p>

        <form action={createWorkspaceAction} className="card space-y-4">
          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          <div>
            <label className="label" htmlFor="name">
              Venue name
            </label>
            <input className="input" id="name" name="name" required placeholder="The Green Fork" />
          </div>
          <div>
            <label className="label" htmlFor="location">
              Location
            </label>
            <input className="input" id="location" name="location" required placeholder="Amsterdam, NL" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="currency">
                Currency
              </label>
              <select className="input" id="currency" name="currency" defaultValue="EUR">
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="fiscalMonthStart">
                Fiscal month starts on
              </label>
              <input
                className="input"
                id="fiscalMonthStart"
                name="fiscalMonthStart"
                type="number"
                min={1}
                max={28}
                defaultValue={1}
              />
            </div>
          </div>
          <button className="btn-primary w-full" type="submit">
            Create workspace
          </button>
        </form>

        <form action={logoutAction} className="mt-4 text-center">
          <button className="text-xs font-medium text-stone-400 hover:text-stone-600" type="submit">
            Not you? Log out
          </button>
        </form>
      </div>
    </div>
  );
}
