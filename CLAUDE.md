# Lab Parfumo PO Pro — Claude Context

> Memory file for future Claude sessions. Read this first.

## Project Overview

Internal Purchase Order (PO) management system for Lab Parfumo (Thai perfume lab).
Originally built in Streamlit, **rewritten from scratch in Next.js 15** during this development cycle.

**Audience**: Admins (จัดซื้อ + manage catalog) + requesters (สร้าง PO).
**Language**: Thai-first UI; English for technical/code labels (PO PRO, KPI, etc.).
**Deployed**: Vercel (region `sin1` for Thai user latency).

---

## Stack

```
Framework:    Next.js 15.5.x (App Router)
Lang:         TypeScript (strict)
Auth:         Cookie sessions (table user_sessions)
DB:           Supabase Postgres
Storage:      Supabase Storage (3 buckets — see "Buckets" below)
Email:        nodemailer + SMTP env vars
PDF:          @react-pdf/renderer (server-side, Node runtime)
UI:           shadcn/ui + Tailwind CSS + lucide-react icons
Fonts:        Sarabun (Thai) + JetBrains Mono — both via next/font/google
Charts:       recharts (lazy-loaded via next/dynamic)
Avatar:       boring-avatars (variant "beam")
Validation:   Zod (lib/actions/schemas.ts)
Cron:         Vercel Cron (vercel.json `crons`)
Toast:        sonner
```

### Key directories

```
app/
  (app)/             — protected routes (layout requires user session)
    layout.tsx       — auth guard + AppHeader + KeyboardShortcuts
    dashboard/       — KPI hero + status grid + action items + insights + charts
    po/              — list (KPI cards, filter chips, saved filters)
    po/[id]/         — detail (workflow timeline, items, attachments, comments)
    po/new/          — create (equipment grid 4-col + cart)
    po/pending-receipt/
    equipment/       — admin only
    withdraw/        — เบิกของ
    budget/          — admin only
    reports/         — admin only (lazy charts)
    users/           — admin only
    settings/        — admin only
    notifications/
  api/
    po/[id]/pdf/     — PDF download
    cron/daily-digest/ — Vercel Cron endpoint (08:00 ICT)
  login/
  change-password/

lib/
  auth/
    session.ts       — cookie + session lookup, with React.cache()
    require-user.ts  — requireUser() / requireAdmin() helpers
    constants.ts     — SESSION_COOKIE etc. (edge-runtime safe)
    password.ts      — bcryptjs hash + validate
    login.ts
  db/                — server-only DB queries (React.cache wrapped)
    po.ts            — PO + activities + comments + deliveries + suppliers
    equipment.ts     — equipment + categories (unstable_cache)
    withdraw.ts
    budget.ts
    search.ts
    users.ts         — users + notifications
  actions/           — Server Actions ("use server")
    po.ts            — createPo, cancelPo, ship, receive, clone, comment, attach
    equipment.ts
    users.ts
    budget.ts
    notifications.ts
    upload.ts        — uploadImage / uploadAttachment + ensureBucket()
    schemas.ts       — Zod schemas (createUser, updatePO, cancelPO, etc.)
    search.ts
  email/index.ts     — sendEmail + sendWelcomeEmail + sendDailyDigest
  pdf/po-document.tsx — PDF layout (Sarabun font from public/fonts)
  types/db.ts        — all shared types (PurchaseOrder, Equipment, Budget, ...)

components/
  ui/                — shadcn primitives + custom (status-pill, confirm-dialog, user-avatar, empty-state)
  po/                — po-row, workflow-timeline
  search-modal.tsx
```

---

## Buckets (Supabase Storage)

| Bucket            | Purpose                       | Auto-provisioned? |
|-------------------|-------------------------------|-------------------|
| `equipment-images` | Equipment photos + custom item photos | Yes (ensureBucket) |
| `delivery-images` | Photos taken when receiving stock | Yes |
| `po-attachments`  | PDF/Word/Excel attached to PO | Yes (added late, auto-creates on first upload) |

`ensureBucket()` in `lib/actions/upload.ts` — race-safe, idempotent, creates if missing.

---

## Auth flow

1. Login page (`/login`) — POST to Server Action → check bcrypt → insert into `user_sessions` → set `lp_session` cookie
2. Middleware: just touches cookie (no DB, edge-runtime safe)
3. `(app)/layout.tsx`: `getCurrentUser()` → if null, redirect `/login`
4. Pages use `requireUser()` / `requireAdmin()` from `lib/auth/require-user.ts`
5. `getCurrentUser` is wrapped in `React.cache()` — DB hit once per request

Idle timeout: 60 min. Cookie max-age: 7 days.

---

## Recent design decisions

### Performance wins
- **Charts lazy-loaded** via `next/dynamic(... ssr: false)` → dashboard 207KB → 114KB, reports 224KB → 111KB
- **React.cache() on every DB query** → layout + page hit DB once per request
- **Promise.all on multi-fetch pages** (PO detail, budget, dashboard)
- **Vercel sin1 region** (closer to Thai users + Supabase ap-southeast-1)
- **Loading skeletons** for every route (`loading.tsx` per page)

### Thai font handling (IMPORTANT)
- Sarabun loaded weights **400-800** (was 400-700; `font-extrabold` requires 800)
- **DO NOT use `font-black`** (weight 900 not loaded → fake-bold breaks Thai)
- **DO NOT apply `tracking-[X]em` (>0.05em) to Thai text** — tone marks (สระบน/ล่าง/วรรณยุกต์) separate from base chars
- Global CSS in `globals.css` caps tracking for `:lang(th)` elements
- For Thai labels in PDF: use `infoEyebrowTh` (no letter-spacing); for English: `infoEyebrow` with tracking

### UX patterns
- **Destructive actions** → `<ConfirmDialog>` modal (with optional reason textarea)
- **Success feedback** → `toast.success()` (non-blocking)
- **Errors** → `toast.error()` for transient, `<Alert>` for persistent
- **Filter/Action buttons** equal-width via `grid-template-columns: repeat(auto-fit, minmax(140px, 1fr))`
- **Image lightbox** on equipment grid + items list (Esc + ←→ keyboard)
- **Multi-image cards**: 1 primary + 3 thumbs; "+N รูปเพิ่ม" overlay if more
- **+N badge** on primary image showing total count
- **Cards with deep-link**: KPI hero columns, InsightCards, status grid all clickable

### Keyboard shortcuts (mounted in `(app)/layout`)
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
Most `(app)/*/page.tsx` exports `dynamic = "force-dynamic"`. **Tradeoff**: prevents Vercel edge caching — every pageview hits Supabase. **Future fix**: switch to ISR (`revalidate: 300`) + `revalidateTag()` in actions.

### `*.vercel.app` Chrome warning
Chrome flags shared subdomain as "deceptive site". Custom domain solves this permanently. Security headers added in `next.config.ts` to improve site reputation, but the real fix is custom domain.

### Force-dynamic prevents tagged caching
If we move off force-dynamic, ensure all mutating server actions call `revalidateTag()` or `revalidatePath()`.

### `as never` casts in Supabase queries
Codebase uses untyped Supabase client → many `as never` casts on `from(...)`. Future: generate types via `supabase gen types`.

---

## Pending / open work

### Receiving history (ประวัติการรับของ) — NOT DONE
User asked for ability to view full delivery details + attachments per receipt.
- File: `app/(app)/po/[id]/page.tsx` lines 263-310 (inline render)
- Need to: extract to `_components/deliveries-list.tsx` with lightbox for delivery photos
- Should show: items_received per item, delivery photos (delivery-images bucket), issue notes
- Reference pattern: `items-list.tsx` (4-image grid + lightbox)

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

---

## Dev commands

```bash
# Install
npm install

# Dev
npm run dev          # http://localhost:3000

# Type check
npx tsc --noEmit

# Production build (always run before push if changing types/structure)
npm run build

# Deploy: just push to main → Vercel auto-deploys
git push
```

### Required env vars (Vercel)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL              # for email links
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD  # optional, for emails
FROM_EMAIL / FROM_NAME           # optional
CRON_SECRET                      # for /api/cron/daily-digest auth
```

---

## Working style

- All session work has been on `main` branch with direct push.
- Commit messages: descriptive subject + bullet list body.
  Always include `Co-Authored-By: Claude` trailer.
- No PR workflow used — `git push` after every meaningful change.
- Toast / ConfirmDialog patterns are consistent across the app.
- ใช้ภาษาไทยใน UI labels เกือบทั้งหมด except eyebrow labels (PO PRO, SUPPLIER, etc.).

---

## Quick git context

To see what changed recently:
```bash
git log --oneline -30
```

Most recent commits should give immediate context on what was just worked on.
