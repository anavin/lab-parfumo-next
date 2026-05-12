# Lab Parfumo PO Pro — Claude Context

> Memory file for future Claude sessions. Read this first.

## Project Overview

Internal Purchase Order (PO) management system for Lab Parfumo (Thai perfume lab).
Originally built in Streamlit, **rewritten from scratch in Next.js 15** during this development cycle.

**Audience**: Admins + Supervisors (จัดซื้อ + manage catalog/users) + Staff (สร้าง PO/รับของ/เบิก).
**Language**: Thai-first UI; English for technical/code labels (PO PRO, KPI, etc.).
**Deployed**: Vercel (region `sin1` for Thai user latency).
**Production URL**: `https://lab-parfumo-next.vercel.app`

## Roles (3-tier)

```
👑 Admin          — สูงสุด: ทุกอย่าง + Settings (Company/Login/Email)
🛡️ Supervisor    — เหมือน admin ยกเว้น settings + จัดการ admin users
👤 Staff (requester) — สร้าง PO, รับของ, เบิกของ, ดูเฉพาะของตัวเอง
```

`requirePrivileged()` = admin OR supervisor (lib/auth/require-user.ts)
`requireAdmin()` = admin only

---

## Stack

```
Framework:    Next.js 15.5.x (App Router)
Lang:         TypeScript (strict)
Auth:         Cookie sessions (table user_sessions) + bcryptjs (cost 14)
DB:           Supabase Postgres
Storage:      Supabase Storage (3 buckets — see "Buckets" below)
Email:        nodemailer + SMTP env vars / DB (admin sets in /settings)
Error track:  Sentry (@sentry/nextjs v10.51.0) — optional, graceful no-op if no DSN
PDF:          @react-pdf/renderer (server-side, Node runtime)
UI:           shadcn/ui + Tailwind CSS + lucide-react icons
Fonts:        Sarabun (Thai) + JetBrains Mono — both via next/font/google
Charts:       recharts (lazy-loaded via next/dynamic)
Avatar:       boring-avatars (variant "beam")
Validation:   Zod (lib/actions/schemas.ts)
Cron:         Vercel Cron (vercel.json `crons`)
Toast:        sonner
Tests:        Vitest (4 test files, 63 unit tests, ~5s runtime)
```

### Key directories

```
app/
  (app)/             — protected routes (layout requires user session)
    layout.tsx       — auth guard + AppHeader + KeyboardShortcuts
    dashboard/       — KPI hero + status grid + action items + insights + charts
    po/              — list (KPI cards, filter chips, saved filters)
    po/[id]/         — detail (workflow timeline, items, attachments, comments, deliveries history)
    po/new/          — create (equipment grid 4-col + cart)
    po/pending-receipt/
    equipment/       — privileged: list + bulk CSV import
    withdraw/        — เบิกของ
    budget/          — admin only
    reports/         — admin only (lazy charts)
    users/           — admin only
    settings/        — admin only (Company/Login/Email tabs); supervisor sees only Lookups tab
    suppliers/       — privileged: list + detail + manage suppliers
    lots/            — privileged: lot/batch list + detail (multi-delivery tracking)
    audit/           — admin only: po_activities + login_attempts viewer
    preferences/     — all users: notification prefs (email + in-app)
    notifications/
  api/
    po/[id]/pdf/     — PDF download
    po/export/       — CSV export
    cron/daily-digest/ — Vercel Cron endpoint (08:00 ICT)
  login/
  change-password/

lib/
  auth/
    session.ts       — cookie + session lookup, with React.cache()
    require-user.ts  — requireUser() / requireAdmin() / requirePrivileged() helpers
    constants.ts     — SESSION_COOKIE etc. (edge-runtime safe)
    password.ts      — bcryptjs hash + validate
    login.ts         — bcrypt verify + 5/15min lockout
  db/                — server-only DB queries (React.cache wrapped)
    po.ts            — PO + activities + comments + deliveries
    equipment.ts     — equipment + categories (unstable_cache)
    withdraw.ts
    budget.ts
    search.ts
    users.ts         — users + notifications
    suppliers.ts     — Supplier queries + getSuppliersWithStats
    lookups.ts       — Lookup queries (cache + usage count)
    lots.ts          — Lot queries (filters, status counts, expiring soon)
    audit.ts         — po_activities + login_attempts (paginated)
    email-settings.ts — SMTP config from DB (with encryption)
  actions/           — Server Actions ("use server")
    po.ts            — createPo, cancelPo, ship, receive (multi-delivery), clone, comment, attach
    equipment.ts     — create, update, delete, approve, bulkCreate (CSV import)
    users.ts
    budget.ts
    notifications.ts — markRead + updateMyPrefsAction
    suppliers.ts     — Supplier CRUD (privileged only)
    lookups.ts       — Lookup CRUD (5 types)
    lots.ts          — createLotsForDelivery (auto from receive), updateLot, markStatus
    upload.ts        — uploadImage / uploadAttachment + ensureBucket()
    schemas.ts       — Zod schemas (createUser, updatePO, cancelPO, etc.)
    search.ts
    settings.ts      — Company + SMTP config save
  email/index.ts     — sendEmail + sendWelcomeEmail + sendDailyDigest + sendPoUpdateEmail
                       + resolveBaseUrl() helper
  pdf/po-document.tsx — PDF layout (Sarabun font from public/fonts)
  crypto/secrets.ts  — AES-256-GCM (SMTP password encryption)
  utils/image.ts     — Browser image compression (HEIC → JPEG)
  csv/parse.ts       — RFC4180-ish CSV parser (+13 unit tests)
  types/db.ts        — all shared types

components/
  ui/                — shadcn primitives + custom (status-pill, confirm-dialog, user-avatar, empty-state, lookup-combobox)
  po/                — po-row, workflow-timeline
  search-modal.tsx

instrumentation.ts   — Sentry init (Node + Edge runtimes)
sentry.client.config.ts / sentry.server.config.ts / sentry.edge.config.ts
```

---

## Navigation (5 dropdown groups)

Navbar redesigned commit `84d619a` — 11 flat items → 5 grouped dropdowns to prevent label wrap:

```
Dashboard │ PO ▾ │ คลัง ▾ │ รายงาน ▾ │ ผู้ใช้
```

- **Dashboard** — standalone (ทุก role)
- **PO ▾** — ใบ PO / รอรับของ / เบิกของ (ทุก role)
- **คลัง ▾** — Catalog / Lot / Supplier (privileged)
- **รายงาน ▾** — งบ / รายงาน / Audit* (*admin only)
- **ผู้ใช้** — privileged

Mobile: flat horizontal-scroll (FLAT_FALLBACK in nav-links.tsx)

---

## Buckets (Supabase Storage)

| Bucket            | Purpose                       | Auto-provisioned? |
|-------------------|-------------------------------|-------------------|
| `equipment-images` | Equipment photos + custom item photos | Yes (ensureBucket) |
| `delivery-images` | Photos taken when receiving stock | Yes |
| `po-attachments`  | PDF/Word/Excel attached to PO | Yes |

`ensureBucket()` in `lib/actions/upload.ts` — race-safe, idempotent.

---

## Tables (from migrations — all idempotent)

| Table | Purpose | Migration file |
|---|---|---|
| `suppliers` | ผู้ผลิต/ผู้ขาย (full CRUD with bank/contact/payment) | `202604_suppliers.sql` |
| `lookups` | Generic dropdown (5 types) | `202604_lookups.sql` |
| `po_deliveries.uq_po_deliveries_no` | UNIQUE constraint (race-safe) | `202604_workflow_atomic.sql` |
| `users.role CHECK` | Allow "supervisor" | `202604_role_supervisor.sql` |
| `company_settings.smtp_*` | SMTP fields | `202604_email_settings.sql` |
| `users.notification_prefs` | JSONB pref per user | `202604_notification_prefs.sql` |
| `users.notification_prefs` defaults | Backfill email_po_status_change=true + email_new_po | `202604_email_status_defaults.sql` |
| `lots` + `withdrawals.lot_id` | Lot/Batch tracking | `202604_lots.sql` |

**FK link**: `purchase_orders.supplier_id → suppliers.id` (auto-set by orderPoAction via name lookup)
**Sequence**: `lot_no_seq` — generates `LOT-YYYY-NNNNN` via `next_lot_no()` RPC

## RPCs (Postgres functions)

| Function | Purpose |
|---|---|
| `increment_equipment_stock(p_id, p_qty)` | Atomic stock +/- (signed qty) |
| `withdraw_stock(p_equipment_id, p_qty)` | Atomic withdraw + check |
| `next_po_delivery_no(p_po_id)` | Atomic delivery_no via advisory lock |
| `next_lot_no()` | Returns `LOT-YYYY-NNNNN` |
| `next_po_number(year_int)` | Returns next PO number |
| `update_suppliers_updated_at()` / `update_lookups_updated_at()` / `update_lots_updated_at()` | Trigger functions |

---

## Auth flow

1. Login page (`/login`) — POST to Server Action → check bcrypt → insert into `user_sessions` → set `lp_session` cookie
2. Middleware: just touches cookie (no DB, edge-runtime safe)
3. `(app)/layout.tsx`: `getCurrentUser()` → if null, redirect `/login`
4. Pages use `requireUser()` / `requireAdmin()` / `requirePrivileged()`
5. `getCurrentUser` is wrapped in `React.cache()` — DB hit once per request

Idle timeout: 60 min. Cookie max-age: 7 days. Account lockout: 5 failed / 15 min.

---

## Email System

### Email functions in `lib/email/index.ts`
1. **`sendWelcomeEmail`** — new user creation (Username + temp password)
2. **`sendDailyDigest`** — admin daily summary (cron 08:00 ICT, filtered by `email_daily_digest` pref)
3. **`sendPoUpdateEmail`** — PO transitions (6 kinds: ordered/shipping/completed/cancelled/issue/new_for_admin)

### `resolveBaseUrl()` priority
```
1. opts.appUrl (override)
2. NEXT_PUBLIC_APP_URL (custom domain — recommend set this)
3. VERCEL_PROJECT_PRODUCTION_URL (auto from Vercel — production alias)
4. VERCEL_URL (auto from Vercel — deployment-specific, SSO protected!)
5. http://localhost:3000 (dev)
```
⚠️ Never rely on `VERCEL_URL` alone — preview deployments have SSO.

### PO status email triggers (sent to **creator** only)
| Transition | Email kind | What's shown |
|---|---|---|
| → "สั่งซื้อแล้ว" | `ordered` | "คาดว่าจะได้รับ {date}" (NO supplier name) |
| → "กำลังขนส่ง" | `shipping` | "Supplier ส่งของแล้ว — เตรียมรับของได้" (NO tracking) |
| → "เสร็จสมบูรณ์" | `completed` | "ปิดงานเรียบร้อย" |
| → "ยกเลิก" | `cancelled` | "โดย {user} • {reason}" |
| → "มีปัญหา" | `issue` | "แจ้งโดย {user} • {issue}" |

### Admin email trigger
- **New PO** created → `new_for_admin` template → all admin/supervisor with `email_new_po=true`

### Per-user prefs (table: `users.notification_prefs` JSONB)
- `email_daily_digest` (default true)
- `email_po_status_change` (default true) — opt-out, was placeholder (false), backfilled in `202604_email_status_defaults.sql`
- `email_new_po` (default true)
- `inapp_po_status_change` / `inapp_po_cancelled` / `inapp_new_po` (default true)

UI: `/preferences` (all users) — Switch toggles, save bar

---

## Multi-Delivery Receive Flow (commit e7e743e)

PO can have multiple `po_deliveries` — supplier splits shipments.

### Server gate (`addDeliveryAction`)
```typescript
const RECEIVABLE_STATUSES = ["กำลังขนส่ง", "รับของแล้ว", "มีปัญหา"];
```

### Validation
- `qty_damaged > qty_received` → reject
- Negative qty → reject
- Status not in receivable → reject (with hint)

### ReceiveForm UX
- Receives `deliveries[]` prop → calculates `alreadyReceivedByItem` (match by equipment_id, fallback by name)
- Pre-fills `qty_received` = `qty_ordered - already_received` (remaining)
- Shows per item: `สั่ง: 100 • รับแล้ว: 60 • เหลือ: 40`
- Receive button label: `"รับของ"` (first) / `"รับของเพิ่ม"` (subsequent)

### Auto-create lots
After successful delivery insert → `createLotsForDelivery()` creates 1 `lot` row per equipment line (with `qty_initial` = `qty_received`). Best-effort, doesn't block flow if `lots` table missing.

---

## Lot/Batch Tracking (Phase E — commit ddbd41c)

### Schema (`migrations/202604_lots.sql`)
- `lot_no` (auto via `next_lot_no()`) — format `LOT-YYYY-NNNNN`
- Provenance: `po_id`, `po_number` (snapshot), `po_delivery_id`, `supplier_name`, `supplier_lot_no`
- Dates: `manufactured_date`, `expiry_date`, `received_date`
- Status: `active` | `depleted` | `expired` | `discarded`
- `withdrawals.lot_id` (optional FK — for future FIFO support)

### Pages
- **`/lots`** — list with 4 KPI cards (by status) + filter: status / search / expiring 7d / 30d
- **`/lots/[id]`** — detail: 3 stats + provenance grid + edit dialog + withdrawal history
- **`LotEditClient`** — admin/supervisor edits supplier_lot_no, manufactured/expiry dates, notes; can mark expired/discarded

---

## CSV Import (Phase C — commit a4b92f2)

### `lib/csv/parse.ts` — minimal RFC 4180 parser
- Quoted fields with commas / embedded quotes / embedded newlines
- BOM strip, CRLF/LF
- 13 unit tests

### `bulkCreateEquipmentAction(rows)`
- Pre-fetch existing names → case-insensitive dedup
- In-batch dedup
- Insert chunks of 100
- Limit 5,000 rows/file
- Returns `{ inserted, skipped, failed, failedReasons }`

### UI: `BulkImportDialog` (3-step wizard)
- Upload (drag-pick + template download)
- Preview (table 200 first rows + per-row validation badges)
- Done (summary)

CSV headers: `name` (required), `category`, `sku`, `unit`, `last_cost`, `stock`, `reorder_level`, `description`

---

## Audit Log (Phase D — commit 0e5b9ce)

### `/audit` page (admin only)
- Tab: PO Activities / Login Attempts
- Filters: date from/to, user search, action dropdown, status (login)
- Pagination 100/page (limit/offset)
- Sticky header table + Bangkok timezone
- Click PO number → /po/[id]

### `lib/db/audit.ts`
- `getPoActivities(filters, page)` — joins `purchase_orders.po_number`
- `getLoginAttempts(filters, page)`
- `getDistinctActions()` — populates filter dropdown

---

## Sentry Error Tracking (Phase A — commit 58c7c7a)

### Files
- `instrumentation.ts` — register() + onRequestError() hook
- `sentry.server.config.ts` (Node), `.edge.config.ts`, `.client.config.ts`

### Config
- Sample rate 30% production, 100% dev
- `tracesSampleRate: 0` (no perf monitoring — save quota)
- Ignored errors: NEXT_REDIRECT, NEXT_NOT_FOUND, ResizeObserver, Non-Error promise

### Activation
- Set `NEXT_PUBLIC_SENTRY_DSN` in Vercel env (any env)
- Without DSN → graceful no-op (no errors, no warnings)

---

## Recent design decisions

### Number input UX (commits 3f47f10 + e53487e + 2284c6c)
Pattern for ALL `type="number"` controlled inputs:
```tsx
value={x === 0 ? "" : x}                       // empty when 0 (placeholder shows "0")
placeholder="0"                                // affordance
onFocus={(e) => e.currentTarget.select()}      // click → select all → type replaces
```
Fixes: leading-zero React quirk ("01" displayed because input.valueAsNumber == state).

### Thai font handling (IMPORTANT)
- Sarabun loaded weights **400-800** (was 400-700; `font-extrabold` requires 800)
- **DO NOT use `font-black`** (weight 900 not loaded → fake-bold breaks Thai)
- **DO NOT apply `tracking-[X]em` (>0.05em) to Thai text** — tone marks (สระบน/ล่าง/วรรณยุกต์) separate from base chars
- Global CSS in `globals.css` caps tracking for `:lang(th)` elements

### UX patterns
- **Destructive actions** → `<ConfirmDialog>` modal (with optional reason textarea)
- **Success feedback** → `toast.success()` (non-blocking)
- **Errors** → `toast.error()` for transient, `<Alert>` for persistent
- **Image lightbox** on equipment grid + items list (Esc + ←→ keyboard)
- **Multi-image cards**: 1 primary + 3 thumbs; "+N รูปเพิ่ม" overlay if more

### Performance wins
- **Charts lazy-loaded** via `next/dynamic(... ssr: false)`
- **React.cache() on every DB query** → layout + page hit DB once per request
- **Promise.all on multi-fetch pages**
- **Vercel sin1 region** (closer to Thai users + Supabase ap-southeast-1)
- **Loading skeletons** for every route

### Keyboard shortcuts
```
/        focus search (synthesizes ⌘K)
N        new PO
G→D      dashboard
G→P      PO list
G→W      withdraw
?        help dialog
Esc      close modal (Radix native)
```

---

## Known caveats

### Force-dynamic everywhere
Most `(app)/*/page.tsx` exports `dynamic = "force-dynamic"`. Tradeoff: prevents Vercel edge caching.

### `*.vercel.app` Chrome warning
Custom domain solves this. Security headers in `next.config.ts` improve site reputation.

### `as never` casts in Supabase queries
Codebase uses untyped Supabase client → many `as never` casts. Future: generate types via `supabase gen types`.

### Email links require NEXT_PUBLIC_APP_URL
Without it, falls back through `VERCEL_PROJECT_PRODUCTION_URL` → `VERCEL_URL` (last has SSO!) → localhost. **Always set explicitly in Vercel.**

---

## Pending / open work

### TODO: ปิดงานอัตโนมัติ — email reminder
User requested: "หากกดรับของแล้ว ไม่ได้กดปิดงานหากเกิน 1 วันจะต้องมีเมล์แจ้งให้ปิดงาน"
- Need: cron job / scheduled task that:
  - Find POs with `status` in `["รับของแล้ว", "มีปัญหา"]` for > 24h since last update
  - Send reminder email to creator (template: "กรุณาปิดงาน PO XXX")
  - Track `last_close_reminder_sent_at` to avoid spam
- Could extend `/api/cron/daily-digest` or add new `/api/cron/close-reminder`

### Performance audit findings (TOP 5 not yet fixed)
1. 🔴 Force-dynamic → ISR on dashboard/budget/reports (-40% Supabase load)
2. 🔴 `select("*")` on hot path → explicit columns (-25% bandwidth)
3. 🔴 N+1 in `calculateActualSpending` (budget) → SQL JOIN
4. 🟡 Suspense boundaries on PO detail (stream activities/comments)
5. 🟡 `optimizePackageImports` in next.config (@radix-ui, lucide-react, recharts)

### Other improvements queue
- Bulk actions on PO list page (multi-select + batch close/PDF)
- Print-friendly route `/po/[id]/print`
- Custom domain (replaces *.vercel.app warning)
- Rate limiting (Upstash KV) on login + create PO
- Submit Safe Browsing review for the deployed URL
- FIFO withdraw selection from `lots` (lot_id auto on withdrawal)
- Expiring lots dashboard alert (use `getExpiringSoonCount()`)

---

## Dev commands

```bash
npm install
npm run dev          # http://localhost:3000
npx tsc --noEmit     # type check
npm run build        # production build (run before push if changing types)
npm test             # vitest run (63 tests)
git push             # → Vercel auto-deploy main
```

### Required env vars (Vercel)
```
# DB (required)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL              # ⚠️ Set explicitly! Without it, emails may use SSO-protected URLs

# SMTP (optional — admin can set in /settings UI)
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD
FROM_EMAIL / FROM_NAME

# Security (recommended)
CRON_SECRET                      # /api/cron/daily-digest — REJECTS if not set
ENCRYPTION_KEY                   # 32 bytes hex (openssl rand -hex 32) — SMTP password AES-256-GCM
NEXT_PUBLIC_SENTRY_DSN           # Sentry error tracking — graceful no-op if missing
```

---

## Working style

- All session work on `main` branch with direct push.
- Commit messages: descriptive subject + bullet body. `Co-Authored-By: Claude` trailer.
- No PR workflow — `git push` after every meaningful change.
- Toast / ConfirmDialog patterns consistent.
- Thai UI labels except eyebrow labels (PO PRO, SUPPLIER, etc.).
- Migration files: idempotent (`CREATE TABLE IF NOT EXISTS`, `ALTER COLUMN IF NOT EXISTS`, `DO $$ ... IF NOT EXISTS $$`).
- Server actions: best-effort secondary actions (email, lot creation) wrapped in try/catch — never block primary flow.
- Diagnostic logs: `console.log` with `[module name]` prefix for grep filter in Vercel logs.

---

## Quick git context

To see what changed recently:
```bash
git log --oneline -30
```

Most recent commits should give immediate context.

## Useful debugging SQL

```sql
-- Unlock locked-out user
DELETE FROM login_attempts WHERE username = 'X' AND success = false AND created_at > NOW() - INTERVAL '15 minutes';
UPDATE users SET failed_login_count = 0 WHERE username = 'X';

-- Verify password matches
SELECT username, (password_hash = crypt('PASSWORD', password_hash)) AS ok FROM users WHERE username = 'X';

-- Set password from SQL (pgcrypto)
UPDATE users SET password_hash = crypt('NEW_PASS', gen_salt('bf', 14)), failed_login_count = 0 WHERE username = 'X';

-- Check notification prefs
SELECT username, email, notification_prefs FROM users;

-- Recent notifications (debug noti flow)
SELECT n.title, u.username, u.email, n.created_at
FROM notifications n LEFT JOIN users u ON u.id = n.user_id
ORDER BY n.created_at DESC LIMIT 10;
```
