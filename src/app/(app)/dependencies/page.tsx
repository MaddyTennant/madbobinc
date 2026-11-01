import Link from "next/link";
import { db } from "@/lib/db";
import { requireCurrentMembership } from "@/lib/tenant";
import { can } from "@/lib/rbac";

const MINOR_BADGE_STYLE = "bg-amber-100 text-amber-700";
const MAJOR_BADGE_STYLE = "bg-red-100 text-red-700";
const UP_TO_DATE_STYLE = "bg-emerald-100 text-emerald-700";

// Icon color follows the badge's own text color (currentColor) — status is never
// carried by color alone, so the icon+label pairing is the actual signal.
function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-[11px] w-[11px] shrink-0">
      <path d="M3 8.5 L6.5 12 L13 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-[11px] w-[11px] shrink-0">
      <path d="M8 1 L15 14 H1 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 6v3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="11.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

// Matches the font pairing used in the one-off Dependency Versions chart artifact:
// IBM Plex Sans for prose/labels, IBM Plex Mono for package names/version numbers.
const FONTS_LINK = (
  <link
    rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
  />
);
const SANS = "font-['IBM_Plex_Sans']";
const MONO = "font-['IBM_Plex_Mono']";

export default async function DependenciesPage() {
  const session = await requireCurrentMembership();
  if (!can(session.role, "dashboard:view")) {
    return (
      <div className={`mx-auto max-w-4xl p-8 ${SANS}`}>
        {FONTS_LINK}
        <p className="text-sm text-stone-500">You don&apos;t have access to this page.</p>
      </div>
    );
  }

  const rows = await db.dependencyVersion.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: [{ repository: "asc" }, { depName: "asc" }],
  });

  if (rows.length === 0) {
    return (
      <div className={`mx-auto max-w-4xl space-y-4 p-8 ${SANS}`}>
        {FONTS_LINK}
        <div>
          <h1 className="text-xl font-normal tracking-tight text-stone-700">Dependency versions</h1>
          <p className="text-sm text-stone-500">Current vs. recommended package versions, from Renovate.</p>
        </div>
        <div className="card">
          <p className="text-sm text-stone-500">
            Nothing synced yet — connect Renovate on the{" "}
            <Link href="/integrations" className="font-medium text-brand-600 hover:underline">
              Integrations page
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  const withUpdates = rows.filter((r) => !r.isUpToDate);
  const majorUpdates = rows.filter((r) => r.nextMajorVersion != null);

  const byRepository = new Map<string, typeof rows>();
  for (const row of rows) {
    const existing = byRepository.get(row.repository);
    if (existing) existing.push(row);
    else byRepository.set(row.repository, [row]);
  }

  return (
    <div className={`mx-auto max-w-5xl space-y-8 p-8 ${SANS}`}>
      {FONTS_LINK}
      <div>
        <h1 className="text-xl font-normal tracking-tight text-stone-700">Dependency versions</h1>
        <p className="text-sm text-stone-500">Current vs. recommended package versions, from Renovate.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card">
          <p className="text-xs text-stone-500">Packages tracked</p>
          <p className={`text-2xl font-normal text-stone-700 ${MONO}`}>{rows.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-stone-500">Updates available</p>
          <p className={`text-2xl font-normal text-stone-700 ${MONO}`}>{withUpdates.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-stone-500">Major updates</p>
          <p className={`text-2xl font-normal text-stone-700 ${MONO}`}>{majorUpdates.length}</p>
        </div>
      </div>

      {[...byRepository.entries()].map(([repository, deps]) => (
        <div key={repository} className="card">
          <h2 className={`mb-3 font-medium text-stone-900 ${MONO}`}>{repository}</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="border-b border-stone-200 text-left">
                  <th className="whitespace-nowrap px-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-stone-400 first:pl-0">
                    Package
                  </th>
                  <th className="whitespace-nowrap px-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-stone-400">
                    Manager
                  </th>
                  <th className="whitespace-nowrap px-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-stone-400">
                    Current
                  </th>
                  <th className="whitespace-nowrap px-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-stone-400">
                    Next minor/patch
                  </th>
                  <th className="whitespace-nowrap px-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-stone-400">
                    Next major
                  </th>
                  <th className="whitespace-nowrap px-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-stone-400 last:pr-0">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {deps.map((d) => (
                  <tr key={d.id} className="border-b border-stone-100 last:border-0">
                    <td className={`whitespace-nowrap px-3 py-2.5 pl-0 ${MONO}`}>
                      {d.depName}
                      {d.depType ? <span className="text-stone-400"> ({d.depType})</span> : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-stone-500">{d.manager}</td>
                    <td className={`whitespace-nowrap px-3 py-2.5 text-stone-500 ${MONO}`}>
                      {d.currentValue ?? d.currentVersion ?? "—"}
                    </td>
                    <td className={`whitespace-nowrap px-3 py-2.5 text-stone-500 ${MONO}`}>
                      {d.nextMinorVersion ? `${d.nextMinorVersion} (${d.nextMinorUpdateType ?? "update"})` : "—"}
                    </td>
                    <td className={`whitespace-nowrap px-3 py-2.5 text-stone-500 ${MONO}`}>
                      {d.nextMajorVersion ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 pr-0">
                      {d.isUpToDate ? (
                        <span className={`badge gap-1 ${UP_TO_DATE_STYLE}`}>
                          <CheckIcon />
                          up to date
                        </span>
                      ) : d.nextMajorVersion ? (
                        <span className={`badge gap-1 ${MAJOR_BADGE_STYLE}`}>
                          <WarningIcon />
                          major available
                        </span>
                      ) : (
                        <span className={`badge gap-1 ${MINOR_BADGE_STYLE}`}>
                          <WarningIcon />
                          update available
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
