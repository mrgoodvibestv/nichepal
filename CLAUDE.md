# NichePal — CLAUDE.md

Developer reference for Claude Code and any contributor working in this repository.

---

## Section 1 — Project Overview

**NichePal** is a Reddit community intelligence tool for businesses. Users paste their website URL, the AI scans it and builds an engagement profile (business name, positioning, target audiences, relevant subreddits). They then generate reports that scrape Reddit for high-relevance threads and return AI-written comment templates tailored to their audience.

**Problem it solves:** Finding which Reddit communities your customers hang out in, and knowing what to say there without sounding like a marketer.

**Who it's for:** Founders, indie hackers, B2B SaaS, content marketers — anyone doing organic Reddit growth.

| | |
|---|---|
| **Live URL** | https://np.goodvibesai.com |
| **GitHub** | https://github.com/mrgoodvibestv/nichepal |
| **Vercel project** | nichepal |
| **Supabase project** | NichePal |
| **Parent brand** | Good Vibes AI |

---

## Section 2 — Tech Stack

| Dependency | Version | Why it's here |
|---|---|---|
| `next` | 14.2.35 | App Router, RSC, server actions, API routes |
| `react` / `react-dom` | ^18 | UI |
| `@supabase/ssr` | ^0.10.2 | Cookie-based auth in Next.js App Router |
| `@supabase/supabase-js` | ^2.103.0 | Supabase client for DB queries |
| `stripe` | ^22.0.2 | Subscriptions, one-time top-ups, billing portal |
| `@anthropic-ai/sdk` | ^0.89.0 | Claude API — report analysis + community search |
| `tailwindcss` | ^3.4.1 | Styling |
| `typescript` | ^5.9.3 | Type safety |

**External services (no npm package — called via `fetch`):**
- **Apify** — Reddit scraping via the `betterdevsscrape~reddit-scraper` actor
- **Vercel** — Hosting + edge middleware

**Stripe SDK version note:** v22 is a breaking change release. `invoice.subscription` is removed. The subscription ID now lives at `invoice.parent.subscription_details.subscription`. All webhook code already accounts for this.

---

## Section 3 — Environment Variables

All variables must be set in `.env.local` (dev) and in the Vercel project settings (prod).

```bash
# Anthropic — report analysis + community search + onboarding scan
ANTHROPIC_API_KEY=

# Apify — Reddit scraping
APIFY_API_TOKEN=

# Stripe — server-side only (never expose)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=     # price_xxx for $49/mo — 50 credits
STRIPE_PRICE_GROWTH=      # price_xxx for $99/mo — 150 credits
STRIPE_PRICE_PRO=         # price_xxx for $249/mo — 500 credits
STRIPE_PRICE_TOPUP=       # price_xxx for $30 one-time — 20 credits

# Stripe — client-side (billing page is a 'use client' component)
# Next.js cannot inline dynamic process.env reads in client components.
# These MUST be NEXT_PUBLIC_ duplicates of the server vars above.
NEXT_PUBLIC_STRIPE_PRICE_STARTER=
NEXT_PUBLIC_STRIPE_PRICE_GROWTH=
NEXT_PUBLIC_STRIPE_PRICE_PRO=
NEXT_PUBLIC_STRIPE_PRICE_TOPUP=

# Site URL — used in Stripe redirect URLs
NEXT_PUBLIC_SITE_URL=https://np.goodvibesai.com

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=    # server-only, never expose — used in service client
```

---

## Section 4 — Database Schema

### Tables

**`profiles`** — one per user
```sql
id                    uuid PK
user_id               uuid FK → auth.users (unique)
business_name         text
url                   text
positioning           text
keywords              text[]
target_subreddits     text[]         -- denormalized flat list from all audiences
tone                  text           -- 'expert' | 'peer-to-peer' | 'challenger' | 'storyteller'
package               text           -- 'starter' | 'growth' | 'pro'  (constraint enforced)
subscription_status   text           -- 'free' | 'active' | 'canceled' | 'past_due'
stripe_customer_id    text
stripe_subscription_id text
credits               int
audiences             jsonb          -- [{ id, name, description, goal, subreddits[] }]
onboarded             boolean
created_at / updated_at
```

**`reports`** — one per generation run
```sql
id                    uuid PK
profile_id            uuid FK → profiles
status                text           -- 'generating' | 'complete' | 'failed'
week_of               date
strategy_note         text           -- Claude's weekly engagement strategy
subreddits_scanned    int
threads_found         int
high_priority_count   int
generated_at          timestamptz
apify_run_id          text
apify_dataset_id      text
selected_subreddits   text[]
audience_id           text
audience_name         text
audience_description  text
audience_goal         text
```

**`threads`** — individual Reddit posts inside a report
```sql
id                    uuid PK
report_id             uuid FK → reports
subreddit             text
title                 text
url                   text
author                text
upvotes               int
num_comments          int
upvote_ratio          float
posted_at             timestamptz
thread_type           text           -- 'trending' | 'rising' | 'evergreen'
priority              text           -- 'high' | 'medium'
relevance_score       int            -- 1–10
why_engage            text
comment_template      text
body_snippet          text
engaged               boolean
engaged_at            timestamptz
```

**`credit_transactions`** — immutable audit log
```sql
id          uuid PK
profile_id  uuid FK → profiles
amount      int        -- positive = grant, negative = deduction
type        text       -- 'grant' | 'deduction'
description text       -- e.g. 'report_generation', 'monthly_credit_reset'
created_at  timestamptz
```

**`community_searches`** — log of Discover page searches (for future analytics)

### RLS Policies

All tables have RLS enabled. Every policy uses `(select auth.uid())` (not `auth.uid()`) to prevent per-row re-evaluation — critical for performance on `threads` queries.

- `profiles`: user owns their row (`user_id = auth.uid()`)
- `reports`: user sees reports where `profile_id` matches their profile
- `threads`: user sees threads via join through reports → profiles
- `credit_transactions`: user sees transactions where `profile_id` matches

### Credit System

| Operation | Credits | Direction |
|---|---|---|
| Onboarding (first profile save) | +10 | welcome grant |
| Report generation | −3 | deduction |
| Community search | −2 | deduction |
| New subscription | +50/150/500 | grant (set directly on activation) |
| Monthly renewal | reset to 50/150/500 | **SET** not ADD |
| Top-up purchase | +20 | grant (additive, never resets) |

**Plans:**
- Starter $49/mo → 50 credits
- Growth $99/mo → 150 credits
- Pro $249/mo → 500 credits
- Top-up $30 one-time → 20 credits (active subscribers only; top-up credits are lost at next monthly reset — by design)

### Postgres RPCs

**`deduct_credits(p_profile_id, p_amount, p_description)`**
- Atomically decrements credits where `credits >= p_amount`
- Inserts a `credit_transactions` row on success
- Returns new balance, or `-1` if insufficient credits

**`grant_credits(p_profile_id, p_amount, p_description)`**
- Atomically increments credits
- Inserts a `credit_transactions` row
- Returns new balance, or `-1` if profile not found

Both functions use `security definer set search_path = ''` — do not remove this.

### Package Constraint

```sql
check (package in ('starter', 'growth', 'pro'))
```

Never add a new plan without updating this constraint in a migration. Adding a plan without the constraint fix will cause webhook activation to fail with a DB constraint violation.

---

## Section 5 — Supabase Client Pattern

There are three distinct Supabase client factories. Use the right one:

| Factory | File | When to use |
|---|---|---|
| `createClient()` | `lib/supabase/server.ts` | All API routes that handle user requests — enforces RLS |
| `createServiceClient()` | `lib/supabase/service.ts` | Webhook routes + any server op that bypasses RLS (uses `SUPABASE_SERVICE_ROLE_KEY`) |
| Browser client | `lib/supabase/client.ts` | `'use client'` components only (e.g. sign-out) |

**Never use `createServiceClient()` in user-facing API routes** — it bypasses RLS and would let any authenticated user read any row.

**Never use `createClient()` in webhook routes** — there is no user session in a Stripe webhook.

---

## Section 6 — Stripe Integration

### Webhook Events Handled

**`checkout.session.completed`**
- Reads `session.metadata.isTopUp`
- **Top-up path:** calls `grant_credits` RPC with +20
- **Subscription path:** maps `priceId` to credits/package, does a direct `UPDATE` on the profile row (sets `credits`, `package`, `subscription_status = 'active'`, `stripe_subscription_id`), inserts a transaction row
- Unknown `priceId` → logs error and returns early (no activation)

**`invoice_payment.paid`**
- Fires every month on renewal
- Only processes `billing_reason === 'subscription_cycle'` — skips first payment (which is handled by `checkout.session.completed`)
- Gets subscription ID via Stripe v22 path: `invoice.parent.subscription_details.subscription`
- **RESETS credits** to plan amount — does a direct `UPDATE`, not an increment
- Top-up credits are lost at renewal — this is intentional

**`customer.subscription.updated`**
- Syncs `subscription_status` from Stripe status (`active` / `past_due` / `canceled`)

**`customer.subscription.deleted`**
- Sets `subscription_status = 'canceled'`, clears `stripe_subscription_id`, sets `package = 'starter'`

### Webhook Safety Rules

- Stripe signature verification is in its own `try-catch` — returns `400` on bad sig (Stripe does not retry 400s)
- All event handling is in a second `try-catch` — always returns `200`, even on error
- Returning `5xx` causes Stripe to retry, which can double-grant credits

### Checkout Route Guards

- Top-up blocked if `subscription_status !== 'active'`
- Subscription creation blocked if `subscription_status === 'active'` (use billing portal for plan changes)

### Billing Portal

`POST /api/stripe/portal` → creates a Stripe billing portal session. Handles upgrades, downgrades, and cancellations. Return URL is `/dashboard/billing`.

---

## Section 7 — Report Generation Pipeline

```
User clicks Generate
        ↓
POST /api/reports/generate
  1. Auth check (createClient + getUser)
  2. Credit check (profile.credits >= 3)
  3. INSERT report row (status: 'generating')
  4. Start Apify actor (betterdevsscrape~reddit-scraper)
     - startUrls + subreddits: [selectedSubreddit]
     - maxPostCount: 15, maxItems: 75, skipComments: true
     - sort: hot, minScore: 1, useApifyProxy: true
  5. If Apify start fails → mark report failed, return 500
  6. DEDUCT 3 credits via deduct_credits RPC
     (only after Apify confirms start — never deduct before)
  7. Save apify_run_id, apify_dataset_id, audience context to report
  8. Return { reportId }
        ↓
Client polls GET /api/reports/status/[id] every 10 seconds
  - Checks Apify run status via Apify REST API
  - RUNNING/READY → { status: 'generating', apifyReady: false }
  - SUCCEEDED → { status: 'generating', apifyReady: true, datasetId }
  - FAILED/ABORTED/TIMED-OUT → mark report failed
        ↓
When apifyReady: true → client calls POST /api/reports/analyze/[id]
  (DashboardClient uses analyzingRef to ensure this fires exactly once per report)
        ↓
POST /api/reports/analyze/[id]
  1. Auth + ownership check (report must belong to user's profile)
  2. Guard: report.status must be 'generating' (prevents double-run)
  3. Fetch profile context (business_name, positioning, keywords)
  4. Fetch Apify dataset items (limit 100)
  5. Filter out community-type items (keep only posts)
  6. Zero-post guard: if Apify returned nothing → mark complete with
     descriptive strategy_note, return early (no Claude call)
  7. Dedup: filter threads seen in other reports this week
  8. Engaged-thread filter: filter URLs marked engaged=true in last 30 days
     (so Claude never sees threads the user already engaged with)
  9. Send up to 40 posts to Claude (claude-sonnet-4-6, max_tokens: 4000)
     - System prompt: Reddit engagement strategist
     - Includes audience context if report has a targeted audience
     - Returns JSON: { strategy_note, threads[] }
 10. sanitizeJson() on Claude response (smart quotes, unescaped double quotes)
 11. INSERT threads, UPDATE report (status: 'complete', stats)
        ↓
DashboardClient detects terminal status → router.refresh()
```

### Community Search Pipeline

`POST /api/community/search` — costs 2 credits

1. Auth check + credit check
2. Deduct 2 credits upfront (before Claude call)
3. Claude suggests 8–10 real subreddits for the query
4. Filter out subreddits the user already has in their audiences
5. Start Apify to verify activity (3 posts per subreddit, 30s timeout)
6. If Apify times out → return Claude suggestions with `active: false`
7. Count posts per subreddit, sort by activity, return results

---

## Section 8 — Security

| Measure | Where | Why |
|---|---|---|
| `createClient() + getUser()` on every API route | All routes except webhook | Prevents unauthenticated access; `getUser()` hits Supabase server to verify JWT |
| `createServiceClient()` in webhooks | `stripe/webhook/route.ts` | Webhooks have no user session — user client would fail |
| SSRF guard `isPublicUrl()` | `api/onboard/scan/route.ts` | Prevents fetching localhost, 10.x, 192.168.x, 172.16–31.x, 169.254.x, GCP internal DNS |
| Atomic credit deduction (`deduct_credits` RPC) | All credit deductions | Eliminates read-then-write race condition |
| Atomic credit grant (`grant_credits` RPC) | All credit grants | Prevents double-granting on duplicate webhook events |
| Double subscription guard | `stripe/checkout/route.ts` | Blocks creating a second subscription while one is active |
| Top-up requires active subscription | `stripe/checkout/route.ts` | No top-ups for free users |
| Webhook try-catch returns 200 | `stripe/webhook/route.ts` | Prevents Stripe retries from double-granting credits |
| Stripe signature verification in isolated try-catch | `stripe/webhook/route.ts` | Bad-sig returns 400 (not retried); handler errors return 200 (not retried) |
| RLS on all tables | Supabase | Users can only see their own data even if they hit service-layer bugs |
| `profile_id` ownership check on report page | `report/[id]/page.tsx` | Double-check beyond RLS — explicit `.eq('profile_id', profile.id)` |
| `analyzingRef` in DashboardClient | `DashboardClient.tsx` | Prevents calling analyze route twice for same report |

---

## Section 9 — UI Layout & Design System

### Layout Architecture

```
app/dashboard/layout.tsx (server)
  └── DashboardShell.tsx ('use client')
        ├── Mobile top bar (h-14, fixed, z-40, lg:hidden)
        │     ├── Hamburger button (left)
        │     ├── NichePal logo (absolute center)
        │     └── Credits badge (right)
        ├── Sidebar ('components/Sidebar.tsx')
        │     ├── Mobile: fixed, slides from left, z-50, backdrop (z-40)
        │     │     rounded-r-2xl, translate-x-0 / -translate-x-full
        │     └── Desktop: lg:relative, always visible, no backdrop
        └── <main> (flex-1 overflow-y-auto pt-14 lg:pt-0)
              └── {children} — page content
```

**Sidebar structure:**
- `h-14` header row: NichePal logo (left) + X close button (`lg:hidden`, right)
- Nav section with section labels and NavItem links
- Credits stat card at bottom

### Design System

| Token | Value |
|---|---|
| Primary gradient | `from-[#4B6BF5] to-[#7B4BF5]` |
| Logo | "Niche" in black, "Pal" in gradient |
| Card radius | `rounded-2xl` |
| Button radius | `rounded-xl` or `rounded-lg` |
| Touch target minimum | `min-h-[44px]` on all interactive elements |
| Padding pattern | `px-4 sm:px-6 lg:px-8` |
| Body font | System sans-serif via Tailwind |

### Mobile Rules

- All buttons and links must have `min-h-[44px]` (WCAG touch target)
- Flex layouts that stack: `flex-col sm:flex-row`
- Full-width buttons on mobile: `w-full sm:w-auto`
- Inputs that expand: `w-full` with `sm:flex-1` where appropriate

---

## Section 10 — Key Patterns and Rules

**1. Never use `createClient()` in webhook routes.**
Webhooks have no user session. Always use `createServiceClient()`. Using `createClient()` in a webhook will silently fail with auth errors.

**2. Never deduct credits before confirming the expensive operation started successfully.**
In `reports/generate`, Apify is started first, then credits are deducted. If Apify fails, no credits are lost. The pattern: start expensive op → confirm success → deduct.

**3. Always use the `deduct_credits` RPC for deductions and `grant_credits` for grants.**
Never read-then-write credits. Two simultaneous requests can both pass a JS-level balance check and both decrement. The RPCs do this atomically in a single SQL statement.

**4. NEXT_PUBLIC_ duplicates of Stripe price IDs are required.**
The billing page is a `'use client'` component. Next.js cannot inline dynamic `process.env` reads in client components at runtime. Always use static `process.env.NEXT_PUBLIC_KEY` references — they are inlined at build time.

**5. Always wrap webhook event handlers in try-catch and return 200.**
Stripe retries webhooks that return 5xx. A transient DB error returning 500 will cause Stripe to retry, potentially double-granting credits. Always return 200 from the webhook handler, even on error.

**6. Stripe v22 breaking change: `invoice.subscription` is removed.**
Use this path instead:
```ts
const subRef =
  invoice.parent?.type === 'subscription_details'
    ? invoice.parent.subscription_details?.subscription ?? null
    : null
const subscriptionId = typeof subRef === 'string' ? subRef : subRef?.id ?? null
```

**7. The `package` column constraint is strict.**
```sql
check (package in ('starter', 'growth', 'pro'))
```
Never set `package` to any other value. Never add a new plan without adding a migration that updates this constraint first — the webhook will throw a DB error and silently fail to activate the subscription.

**8. Always apply `sanitizeJson()` to Claude API responses.**
Claude sometimes returns smart quotes (`"` `"`) or unescaped double quotes inside JSON string values. `sanitizeJson()` in `analyze/[id]/route.ts` handles both. Copy this function if adding a new Claude route that parses JSON.

**9. `DashboardClient` polls status every 10 seconds and triggers analysis exactly once.**
The `analyzingRef` set prevents calling `POST /api/reports/analyze/[id]` twice for the same report. The analyze route also has its own guard (`report.status !== 'generating'` returns early), providing defense in depth.

**10. Onboarding is the credit entry point.**
New users get 10 free credits on first profile save (`profile/save/route.ts`). This is gated by checking whether the profile row existed before the upsert. There are no other free-credit paths outside of subscription activation.

---

## Section 11 — What's Not Built Yet / Next Priorities

**Missing features:**
- Email notifications (report ready, low credits, payment failed)
- Customer support integration
- Admin dashboard (view all users, credit usage, MRR)
- Analytics / usage tracking (per-user report counts, engagement rates)
- API rate limiting per user (currently unlimited concurrent requests)
- Email/password reset flow (Supabase magic link is the only path today)
- Multi-seat / team accounts
- Report history search / filtering by audience
- Webhook for `invoice.payment_failed` (to notify users of failed renewals)
- Demo mode without signup (landing page `api/demo/scan` exists but isn't wired to the UI flow end-to-end)

**Known limitations:**
- Community search (Discover page) has a 30-second hard timeout on Apify polling — if Apify is slow, results come back without post-count verification
- Top-up credits are silently lost at the next monthly renewal cycle (correct by design, but not communicated to users in the UI)
- The `week_of` column on reports is not used for deduplication — dedup uses the actual `generated_at` timestamp and a Monday-based week window
