import Link from "next/link";
import { loginAction } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold text-slate-900">Madbob Spend</h1>
        <p className="mb-6 text-sm text-slate-500">AI-driven spend management for restaurants.</p>

        <form action={loginAction} className="card space-y-4">
          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input className="input" id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              className="input"
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <button className="btn-primary w-full" type="submit">
            Log in
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          No account yet?{" "}
          <Link className="font-medium text-brand-600 hover:underline" href="/signup">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
