# Salto CloudWorks — AI spend platform

1. Onboarding & workspace setup - Company signs up / logs in (email + password), creates a company workspace (Company Name, Location), and invites team members with role-based permissions (Owner, Finance Manager, Manager, Viewer) so all spend data stays inside the company's own tenant.

2. Integration hub ("sits within their realm") - A connections page where the company links its cloud stack: observability (Datadog), CDN/edge (Fastly), and cloud infrastructure (Azure). Fastly is a real integration — it authenticates with a Fastly API token and pulls actual billing data (finalized invoices plus the current month-to-date) straight from Fastly's own billing API; Datadog and Azure are mocked for now. Each connector is configured with credentials/API keys stored server-side, shows sync status, last sync time, and record counts. Includes a CSV/spreadsheet importer and a generic webhook endpoint so any tool not on the list can still push data in.

3. Unified spend data layer - All synced records normalized into one schema (vendors, invoices, line items, purchase orders, transactions, categories, GL codes, cost centers). Automatic categorization of every transaction into spend buckets with confidence scores and manual override.

4. AI spend analyst dashboard - Executive view with total spend, spend by category and by vendor, month-over-month trend, budget vs actual, and cash-out forecast for the next 30 days. Each metric card is backed by real aggregated data from the connected tools.

5. LLM oversight engine (automated monitoring) - A scheduled backend job runs the LLM (Claude Opus 5) across the connected data to detect price creep, duplicate/double-billed invoices, off-contract or overpriced purchases, unusual vendor spikes, subscription/cloud-spend waste, and budget overruns. Each finding is written to an "Insights & Alerts" feed with a severity level, the evidence rows it was derived from, estimated dollar impact, and a recommended action the manager can accept or dismiss.

6. Natural-language query console ("query over these tools") - A chat interface where staff ask questions in plain English, e.g. "How much did we spend on Azure compute last quarter?", "Which vendor raised prices the most this month?", "Why was our Datadog bill up in June?". The LLM (GPT-5.6 Sol) translates the question into a safe, tenant-scoped query over the unified spend tables, then answers with a written explanation plus a supporting table/chart and the source records used. Query history is saved and can be re-run or pinned to the dashboard.

7. Budgets, approvals & controls - Set monthly budgets per category and per location, define approval thresholds, and route purchase requests above a limit to an approver. Real-time alerts when a category is trending over budget, with the AI suggesting where to cut.

8. Vendor intelligence - Per-vendor profile showing total spend, invoice history, average unit price trend, payment terms, and an AI-generated negotiation brief (price history + benchmark against your other vendors for the same item) the manager can use in renewal talks.

9. Reporting & export - Generate a monthly AI spend summary (written narrative + key numbers + top actions), export data to CSV, and download a PDF report for owners or accountants.

10. Embeddable widget & API access - So the tool can live inside the company's existing stack: an embeddable read-only dashboard/query widget (iframe snippet with a scoped token) plus a documented REST endpoint and API key management page, letting the company surface spend insights inside their own internal portal.

11. Dependency versions - A separate page showing current vs. recommended package versions across the company's repos. Also a real integration: it authenticates with a GitLab API token and pulls the latest Renovate report straight from a GitLab CI job's artifacts (current version, recommended version, and update type — major/minor/patch — per package).
