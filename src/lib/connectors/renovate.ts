import "server-only";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

const GITLAB_API_BASE = "https://gitlab.com/api/v4";
const REQUEST_TIMEOUT_MS = 15_000;

interface RenovateUpdate {
  bucket?: string; // "major" for breaking bumps, anything else (typically "non-major") for safe ones
  updateType?: string;
  newVersion?: string;
  newValue?: string;
}

interface RenovateDep {
  depName: string;
  depType?: string; // e.g. "required_provider" vs "provider" (Terraform) — disambiguates same depName+manager
  skipReason?: string; // e.g. "unspecified-version" — Renovate found no version to track at all
  currentValue?: string;
  currentVersion?: string;
  updates?: RenovateUpdate[];
}

interface RenovatePackageFile {
  packageFile: string;
  deps?: RenovateDep[];
}

interface RenovateRepository {
  packageFiles?: Record<string, RenovatePackageFile[]>;
}

interface RenovateReport {
  repositories?: Record<string, RenovateRepository>;
}

interface RenovateCredentials {
  gitlab_api_token?: string;
  project_id_or_path?: string;
  ci_job_name?: string;
  branch_ref?: string;
}

interface DependencyRow {
  repository: string;
  manager: string;
  packageFile: string;
  depName: string;
  depType: string | null;
  currentValue: string | null;
  currentVersion: string | null;
  nextMinorVersion: string | null;
  nextMinorUpdateType: string | null;
  nextMajorVersion: string | null;
  isUpToDate: boolean;
}

/** Thin wrapper over GitLab's REST API. Never logs or throws the token itself. */
async function fetchRenovateArtifact(creds: Required<RenovateCredentials>): Promise<RenovateReport> {
  const url = `${GITLAB_API_BASE}/projects/${encodeURIComponent(creds.project_id_or_path)}/jobs/artifacts/${encodeURIComponent(
    creds.branch_ref,
  )}/raw/renovate-report.json?job=${encodeURIComponent(creds.ci_job_name)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", "PRIVATE-TOKEN": creds.gitlab_api_token },
      signal: controller.signal,
    });
  } catch {
    throw new Error("Could not reach the GitLab API. Check your network connection and try again.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    if (response.status === 401) throw new Error("Invalid GitLab API token.");
    if (response.status === 403) throw new Error("This GitLab API token doesn't have access to this project.");
    if (response.status === 404) {
      throw new Error(
        "No artifact found — check the project ID, branch, and job name, and that the pipeline has run at least once.",
      );
    }
    throw new Error(`GitLab API error (status ${response.status}).`);
  }

  return response.json() as Promise<RenovateReport>;
}

/**
 * Picks the highest-version update within one bucket ("major" for breaking
 * bumps, everything else for safe ones). Renovate can offer both a safe and
 * a breaking bump for the same dependency at once (e.g. a minor AND a major
 * both available) — within a bucket, entries are ordered smallest to
 * largest, so the last match is the highest version in that bucket.
 */
function pickUpdate(updates: RenovateUpdate[] | undefined, bucket: "major" | "non-major"): RenovateUpdate | undefined {
  const matches = (updates ?? []).filter((u) => (u.bucket === "major") === (bucket === "major"));
  return matches[matches.length - 1];
}

/** Flattens a Renovate report into one row per dependency. */
function parseReport(report: RenovateReport): DependencyRow[] {
  const rows: DependencyRow[] = [];

  for (const [repository, repoData] of Object.entries(report.repositories ?? {})) {
    for (const [manager, files] of Object.entries(repoData.packageFiles ?? {})) {
      for (const file of files) {
        for (const dep of file.deps ?? []) {
          // Skip deps with no version to track at all (e.g. a Terraform `provider "x" {}`
          // block, as opposed to its `required_providers` entry — the block itself has
          // no version attribute, so there's nothing meaningful to report here).
          if (dep.skipReason && !dep.currentValue && !dep.currentVersion) continue;

          const nextMinor = pickUpdate(dep.updates, "non-major");
          const nextMajor = pickUpdate(dep.updates, "major");
          rows.push({
            repository,
            manager,
            packageFile: file.packageFile,
            depName: dep.depName,
            depType: dep.depType ?? null,
            currentValue: dep.currentValue ?? null,
            currentVersion: dep.currentVersion ?? null,
            nextMinorVersion: nextMinor?.newVersion ?? nextMinor?.newValue ?? null,
            nextMinorUpdateType: nextMinor?.updateType ?? null,
            nextMajorVersion: nextMajor?.newVersion ?? nextMajor?.newValue ?? null,
            isUpToDate: !dep.updates?.length,
          });
        }
      }
    }
  }

  return rows;
}

function requireCredentials(credentials: Record<string, string>): Required<RenovateCredentials> {
  const { gitlab_api_token, project_id_or_path, ci_job_name, branch_ref } = credentials as RenovateCredentials;
  if (!gitlab_api_token || !project_id_or_path || !ci_job_name || !branch_ref) {
    throw new Error("GitLab API token, project ID, CI job name, and branch are all required.");
  }
  return { gitlab_api_token, project_id_or_path, ci_job_name, branch_ref };
}

async function replaceDependencyVersions(workspaceId: string, connectorId: string, rows: DependencyRow[]): Promise<number> {
  await db.dependencyVersion.deleteMany({ where: { connectorId } });
  if (rows.length === 0) return 0;
  await db.dependencyVersion.createMany({
    data: rows.map((row) => ({ ...row, workspaceId, connectorId })),
  });
  return rows.length;
}

/**
 * Validates the credentials, connects the Renovate connector, and imports
 * the current report snapshot. Throws (writing nothing to the DB) if the
 * credentials are invalid or the artifact can't be reached.
 */
export async function connectRenovateConnector(workspaceId: string, credentials: Record<string, string>) {
  const creds = requireCredentials(credentials);
  const report = await fetchRenovateArtifact(creds);

  const connector = await db.connector.upsert({
    where: { workspaceId_type_provider: { workspaceId, type: "DEPENDENCIES", provider: "renovate" } },
    update: { status: "CONNECTED", encryptedConfig: encryptSecret(JSON.stringify(credentials)), lastError: null },
    create: {
      workspaceId,
      type: "DEPENDENCIES",
      provider: "renovate",
      status: "CONNECTED",
      encryptedConfig: encryptSecret(JSON.stringify(credentials)),
    },
  });

  const rows = parseReport(report);
  const recordCount = await replaceDependencyVersions(workspaceId, connector.id, rows);

  return db.connector.update({
    where: { id: connector.id },
    data: { status: "CONNECTED", lastSyncAt: new Date(), recordCount, lastError: null },
  });
}

/** Re-syncs the latest report, fully replacing this connector's dependency rows. */
export async function runRenovateSync(connectorId: string) {
  const connector = await db.connector.findUniqueOrThrow({ where: { id: connectorId } });

  try {
    if (!connector.encryptedConfig) throw new Error("Renovate isn't connected.");
    const creds = requireCredentials(JSON.parse(decryptSecret(connector.encryptedConfig)));

    const report = await fetchRenovateArtifact(creds);
    const rows = parseReport(report);
    const recordCount = await replaceDependencyVersions(connector.workspaceId, connector.id, rows);

    return await db.connector.update({
      where: { id: connectorId },
      data: { status: "CONNECTED", lastSyncAt: new Date(), recordCount, lastError: null },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Renovate sync failed.";
    return db.connector.update({ where: { id: connectorId }, data: { status: "ERROR", lastError: message } });
  }
}
