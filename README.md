# AirDesk

Customers, jobs, scheduling, and invoicing for HVAC and field-service contractors — a real customer list, jobs you can schedule and track start to finish, itemized invoices with automatic tax/VAT, and a shareable no-login invoice link.

## Stack

- React + Vite + Tailwind CSS
- Supabase (Postgres, Auth, Row Level Security)
- jsPDF for invoice export

## Local setup

```bash
npm install
cp .env.example .env   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

## Database

Apply `supabase/migrations/0001_init.sql` to a Supabase project. It creates:

- `profiles` — one row per user, company details used on invoices (auto-created on signup via a trigger).
- `customers` — a contractor's client list.
- `jobs` — one row per service call: customer, service type, status (requested → scheduled → in progress → completed/cancelled), schedule, technician, invoice status, and a random `share_token` for the public invoice link.
- `job_items` — itemized line items (parts, labor, fees) per job.
- `get_public_invoice(token)` — a security-definer RPC that's the *only* way the public `/invoice/:token` page reads data; there is no direct anon table access, so a leaked link can only ever expose the one job it points to.

All tables are RLS-protected to `owner_id = auth.uid()`.

## Deploying

Any static host works (Vercel, Netlify, Cloudflare Pages) — `npm run build` produces `dist/`. Set the two `VITE_SUPABASE_*` env vars in the host's dashboard.
