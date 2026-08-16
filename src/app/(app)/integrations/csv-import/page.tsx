import Link from "next/link";
import { importCsvAction } from "../actions";

export default async function CsvImportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; imported?: string; skipped?: string; errors?: string }>;
}) {
  const { error, imported, skipped, errors } = await searchParams;

  return (
    <div className="mx-auto max-w-xl space-y-6 p-8">
      <div>
        <h1 className="text-xl font-normal tracking-tight text-stone-700">Import from CSV</h1>
        <p className="text-sm text-stone-500">
          Columns: <code>date, vendor, description, amount</code>, plus optional <code>category</code> (a category
          key such as <code>food_cost</code>) and <code>cost_center</code>.
        </p>
      </div>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {imported !== undefined ? (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Imported {imported} transaction(s), skipped {skipped}.
          {errors ? <p className="mt-1 text-xs text-emerald-800">{errors}</p> : null}
        </div>
      ) : null}

      <form action={importCsvAction} className="card space-y-4" encType="multipart/form-data">
        <div>
          <label className="label" htmlFor="file">
            CSV file
          </label>
          <input className="input" id="file" name="file" type="file" accept=".csv,text/csv" required />
        </div>
        <button className="btn-primary w-full" type="submit">
          Upload &amp; import
        </button>
      </form>

      <Link href="/integrations" className="text-sm text-brand-600 hover:underline">
        &larr; Back to integrations
      </Link>
    </div>
  );
}
