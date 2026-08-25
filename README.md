# Utah Leads — CRM

Lead pulling and pipeline management for an exterior-cleaning operation in Salt Lake City.
React + Vite + TypeScript front end, Supabase for data and auth, n8n behind a Supabase Edge
Function for the actual pull.

The approved visual design lives in [`reference/demo.html`](reference/demo.html) — a
standalone static demo with fake data. `src/index.css` is ported from it, so open the two
side by side if you ever need to check a colour or spacing decision.

---

## Requirements

- Node 18+ (built and tested on Node 24)
- A Supabase project — this app targets `hbmocyetjsykqusvaevu`
- [Supabase CLI](https://supabase.com/docs/guides/cli) for deploying the Edge Function

## Install and run locally

```bash
npm install
cp .env.example .env      # then fill in VITE_SUPABASE_ANON_KEY
npm run dev               # http://localhost:5173
```

## Environment variables

Only `VITE_*` variables reach the browser bundle. Everything in `.env` is public once the
site is built — treat it that way.

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `.env` (front end) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `.env` (front end) | Anon key; safe to ship, RLS does the gating |
| `N8N_WEBHOOK_URL` | Edge Function secret | The n8n production webhook |
| `N8N_SECRET` | Edge Function secret | Sent to n8n as the `x-crm-key` header |
| `ALLOWED_ORIGIN` | Edge Function secret | Comma-separated origins allowed through CORS |

**Never** put the `service_role` key or `N8N_SECRET` in `.env` — they would end up in
`dist/` and any visitor could read them out and spend real credit.

## Accounts

There is no public sign-up. Create users by hand in **Supabase → Authentication → Users**.
RLS is on, so an unauthenticated browser gets empty result sets; the app shows the login
screen and issues no queries at all until a session exists.

---

## Edge Function: `pull-leads`

The browser never talks to n8n. It calls this function, which authenticates the caller,
validates the input, and forwards the request using server-side secrets.

```bash
# one time
supabase link --project-ref hbmocyetjsykqusvaevu

# secrets (never committed)
supabase secrets set N8N_WEBHOOK_URL="https://n8n.example.com/webhook/pull-leads"
supabase secrets set N8N_SECRET="…"
supabase secrets set ALLOWED_ORIGIN="https://crm.example.com"

# deploy
supabase functions deploy pull-leads

# logs
supabase functions logs pull-leads
```

### CORS

`http://localhost:5173` and `http://localhost:4173` are always allowed, so local dev works
without any configuration. `ALLOWED_ORIGIN` **adds** production origins (comma-separated)
rather than replacing the dev ones. An origin that isn't on the list gets no
`Access-Control-Allow-Origin` header at all and the refusal is logged — check
`supabase functions logs pull-leads` if a deployed front end is blocked.

If you want to drop localhost in production, remove `DEV_ORIGINS` from the union in
`allowedOrigins()`.

`supabase/config.toml` sets `verify_jwt = false` for this function. That is deliberate:
preflight `OPTIONS` requests carry no `Authorization` header, so the platform JWT check
would reject them before the function runs and the browser would report a CORS error. The
function authenticates every non-preflight request itself with `supabase.auth.getUser()`
and returns 401 without a valid session, so nothing is actually unprotected. If you deploy
without the config file, pass the flag explicitly:

```bash
supabase functions deploy pull-leads --no-verify-jwt
```

Contract:

```
POST /functions/v1/pull-leads
Authorization: Bearer <user jwt>       # required, 401 without a valid session
{ "count": 50, "solar": "solar" | null, "stories": "two-story" | null }

→ 200 { "ok": true, "pull_id": "…", "requested": 50 }
```

`count` must be a whole number between 1 and 2000. After the call returns, the front end
polls `ut_v_pulls` every 2s (5-minute timeout) until the row for that `pull_id` appears
with `leads > 0`.

---

## Data model

Read-only views, plus one table for writes:

- `ut_v_leads` — delivered leads. Fetched once per session and filtered on the client.
- `ut_v_pulls` — pull history (last 10 shown).
- `ut_leads` — the only write target. The app updates `stage`, `notes`, `call_attempts`
  and `last_contacted_at`, always by `id`.

`ut_v_summary` is deliberately **not** queried: it exposes `available_stock`, which must
never be visible to the client. Every dashboard number is computed from `ut_v_leads`.

### Stages

| Database value | Shown as | Colour |
| --- | --- | --- |
| `new` | Not contacted | `#6B7280` |
| `calling` | Calling | `#F59E0B` |
| `talked` | Talked | `#3B82F6` |
| `appointment` | Booked | `#A855F7` |
| `won` | Done | `#22C55E` |
| `lost` | Not interested | `#EF4444` |
| `do_not_call` | — | hidden from the board |

`notes` is a jsonb **array**. Adding a note reads the current array, prepends
`{ id, body, created_at }` and writes the whole array back — existing notes are preserved.

### Compliance flags

Leads whose phone is on the Do Not Call list are **delivered, not discarded** — the caller
decides. `ut_v_leads` exposes three booleans that must stay visible:

| Field | Shown as | Where |
| --- | --- | --- |
| `is_litigator` | `LITIGATOR` (solid red) | card tag + drawer warning banner |
| `phone_dnc` | `DNC` (soft red) | card tag + drawer warning banner + Dashboard strip |
| `is_deceased` | `Deceased` (grey) | card tag |

Card tags are ordered `LITIGATOR → DNC → Deceased → Solar → 2-story`, so the legal risk
always reads first. When a lead is both a litigator and on DNC, the drawer shows only the
litigator warning — the graver of the two.

`extra_phones` is a jsonb array of `{ phone, type, dnc, last_seen, score }`, listed in the
drawer under "Other numbers", sorted by `score` descending. The section is omitted entirely
when the array is empty.

The queries use `select('*')`, so new view columns arrive without a query change — only
`src/lib/types.ts` needs updating.

### Pricing

The client price is always `leads × $0.40`, computed in the app. `ut_v_pulls.cost_usd` is
the internal cost and is never displayed.

---

## Build and deploy

```bash
npm run build      # tsc --noEmit && vite build → dist/
npm run preview    # serve dist/ locally to sanity-check
```

Verify no secret leaked into the bundle before shipping:

```bash
grep -ri "n8n\|service_role" dist/ || echo "clean"
```

### Nginx on the VPS

```bash
git clone <your repo> /var/www/utah-leads
cd /var/www/utah-leads
npm ci
cp .env.example .env && nano .env     # fill in VITE_SUPABASE_ANON_KEY
npm run build
```

The build output is fully static. Point Nginx at `dist/`:

```nginx
server {
    listen 80;
    server_name crm.example.com;
    root /var/www/utah-leads/dist;
    index index.html;

    # Hashed asset filenames — cache them hard.
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri /index.html;
    }
}
```

Then add TLS with `certbot --nginx -d crm.example.com`, and set that same origin in
`ALLOWED_ORIGIN` for the Edge Function.

Navigation is hash-based (`#pull`, `#dashboard`, `#pipeline`), so no server-side rewrite
rules are needed beyond the `try_files` line above.

To redeploy after a change: `git pull && npm ci && npm run build`. Nginx serves the new
files immediately — no restart required.

---

## Branding

The sidebar and login screen load `public/logo-lumix.png`. Drop the Lumix PNG there; if the
file is missing the app falls back to a plain "Lumix" wordmark rather than a broken image.

## Project layout

```
reference/demo.html              approved visual reference (static, fake data)
src/lib/                         supabase client, types, constants, formatting, filters
src/providers/                   auth session, toasts, shared lead/pull cache
src/components/                  Sidebar, Login, StatCard, LeadCard, LeadDrawer, …
src/pages/                       PullLeads, Dashboard, Pipeline
supabase/functions/pull-leads/   Edge Function that guards the n8n secret
```
