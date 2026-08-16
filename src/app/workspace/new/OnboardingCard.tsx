"use client";

import { useState } from "react";
import type { Vertical } from "@prisma/client";

const SELECTABLE_VERTICALS: { value: Vertical; label: string }[] = [
  { value: "HOSPITALITY", label: "Hospitality" },
  { value: "HEALTHCARE", label: "Healthcare" },
  { value: "TECH", label: "Tech" },
];

/**
 * Renders the heading, intro copy, and body of the workspace creation form.
 * Client-side because both the copy and the visible fields change live as
 * the user picks a vertical, with no round trip needed. `action` is a server
 * action passed down from the server-rendered page.
 *
 * In Tech-only mode (`techOnlyMode`), there's nothing to pick — the vertical
 * selector is omitted entirely and the workspace is always Tech.
 */
export function OnboardingCard({
  techOnlyMode,
  action,
  error,
}: {
  techOnlyMode: boolean;
  action: (formData: FormData) => void;
  error?: string;
}) {
  const [vertical, setVertical] = useState<Vertical>(techOnlyMode ? "TECH" : "HOSPITALITY");
  const isTech = vertical === "TECH";

  return (
    <>
      <h1 className="mb-1 text-2xl font-normal tracking-tight text-stone-700">
        {isTech ? "Set up your company" : "Set up your venue"}
      </h1>
      <p className="mb-6 text-sm text-stone-500">
        This creates a private workspace — all connected data and AI insights stay inside it.
      </p>

      <form action={action} className="card space-y-4">
        {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {techOnlyMode ? (
          <input type="hidden" name="vertical" value="TECH" />
        ) : (
          <div>
            <label className="label" htmlFor="vertical">
              Vertical
            </label>
            <select
              className="input"
              id="vertical"
              name="vertical"
              value={vertical}
              onChange={(e) => setVertical(e.target.value as Vertical)}
            >
              {SELECTABLE_VERTICALS.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="name">
            {isTech ? "Company Name" : "Venue name"}
          </label>
          <input
            className="input"
            id="name"
            name="name"
            required
            placeholder={isTech ? "Salto CloudWorks" : "The Green Fork"}
          />
        </div>
        <div>
          <label className="label" htmlFor="location">
            Location
          </label>
          <input className="input" id="location" name="location" required placeholder="Amsterdam, NL" />
        </div>
        {isTech ? null : (
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
        )}
        <button className="btn-primary w-full" type="submit">
          {isTech ? "Create company workspace" : "Create workspace"}
        </button>
      </form>
    </>
  );
}
