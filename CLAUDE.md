# Lab Parfumo PO Pro — Claude Context

> Memory file for future Claude sessions. Read this first.
> Last updated: 2026-05-14 (after audit round 2 + ALL Future Iterations F1-F6)

## Project Overview

Internal Purchase Order (PO) management system for Lab Parfumo (Thai perfume lab).
Originally built in Streamlit, **rewritten from scratch in Next.js 15**.

**Audience**: Admins + Supervisors (จัดซื้อ + manage catalog/users) + Staff (สร้าง PO/รับของ/เบิก).
**Language**: Thai-first UI; English for technical/code labels (PO PRO, KPI, etc.).
**Deployed**: Vercel (region `sin1` for Thai user latency).
**Production URL**: `https://lab-parfumo-next.vercel.app`

## Roles (3-tier)

```
👑 Admin          — สูงสุด: ทุกอย่าง + Settings (Company/Login/Email) + Audit
🛡️ Supervisor    — เหมือน admin ยกเว้น settings + จัดการ admin users
👤 Staff (requester) — สร้าง PO, รับของ, เบิกของ, ดูเฉพาะของตัวเอง / status >= สั่งซื้อแล้ว
```

`requirePrivileged()` = admin OR supervisor (lib/auth/require-user.ts)
`requireAdmin()` = admin only

---

## Stack

```
Framework:    Next.js 15.5.x (App Router, TypeScript strict)
Lang:         TypeScript (strict)
Auth:         Cookie sessions + bcryptjs (cost 14) + 5/15min lockout
DB:           Supabase Postgres
Storage:      Supabase Storage (3 buckets — see "Buckets" below)
Email:        nodemailer + SMTP env / DB config + AES-256-GCM encryption
Error track:  Sentry (@sentry/nextjs v10.51) — graceful no-op if no DSN
PDF:          @react-pdf/renderer (server-side, Node runtime)
UI:           shadcn/ui + Tailwind CSS + lucide-react icons
Fonts:        Sarabun (Thai, weights 400-800) + JetBrains Mono — both via next/font/google
Charts:       recharts (lazy-loaded via next/dynamic)
Avatar:       boring-avatars (variant "beam")
Validation:   Zod (lib/actions/schemas.ts)
Cron:         Vercel Cron (vercel.json `crons`) — daily-digest + close-reminder
Toast:        sonner
Tests:        Vitest (4 files, 63 tests, ~5s runtime)
```

### Key directories

```
app/
  (app)/             — protected routes (layout requires user session)
    layout.tsx       — auth guard + AppHeader + KeyboardShortcuts
    dashboard/       — KPI hero + status grid + action items + insights + charts
    po/              — list (KPI cards, filter chips, saved filters, bulk delete)
    po/[id]/         — detail (workflow timeline, items, attachments, comments, deliveries, lightbox+slideshow)
    po/new/          — create (equipment grid 4-col + cart)
    po/pending-receipt/
    equipment/       — privileged: list + bulk CSV import + categories
    withdraw/        — เบิกของ (auto FIFO consume lots)
    budget/          — admin only
    reports/         — admin only (lazy charts) + CSV export
    users/           — admin only
    settings/        — admin only (Company/Login/Email); supervisor sees only Lookups
    suppliers/       — privileged: list + detail + manage
    lots/            — privileged: lot/batch list + detail (multi-delivery tracking)
    audit/           — admin only: po_activities + login_attempts viewer
    preferences/     — all users: notification prefs (email + in-app)
    notifications/
  api/
    po/[id]/pdf/     — PDF download
    po/export/       — CSV export (formula-injection safe)
    cron/daily-digest/   — 08:00 ICT (Vercel Cron)
    cron/close-reminder/ — 09:00 ICT (throttle 3 days, gắn last_close_reminder_sent_at)
  login/
  change-password/

lib/
  auth/
    session.ts       — cookie + session lookup, with React.cache()
    require-user.ts  — requireUser() / requireAdmin() / requirePrivileged()
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
    suppliers.ts     — Supplier queries + getSuppliersWithStats + getSupplierOptions (merged)
    lookups.ts       — Lookup queries (cache + usage count)
    lots.ts          — Lot queries (filters, status counts, expiring soon)
    audit.ts         — po_activities + login_attempts (paginated, filters)
    email-settings.ts — SMTP config from DB (with AES-256 encryption)
  actions/           — Server Actions ("use server")
    po.ts            — createPo, cancelPo, ship, receive (multi-delivery), clone (perm gate),
                       comment (perm gate), attach (perm gate),
                       bulkDeletePoAction, revertStatusAction
    equipment.ts     — create, update, delete, approve, bulkCreate (CSV import w/ validation)
    users.ts
    budget.ts
    notifications.ts — markRead + updateMyPrefsAction
    suppliers.ts     — Supplier CRUD (privileged only)
    lookups.ts       — Lookup CRUD (5 types)
    lots.ts          — createLotsForDelivery (auto, with unit from equipment),
                       updateLot, markStatus
    upload.ts        — uploadImage (+ magic bytes verify) / uploadAttachment + ensureBucket()
    schemas.ts       — Zod schemas (createUser, updatePO, cancelPO, etc.)
    search.ts
    settings.ts      — Company + SMTP config save
  email/index.ts     — sendEmail + sendWelcomeEmail + sendDailyDigest + sendPoUpdateEmail
                       + resolveBaseUrl() + sanitizeSubject() helpers
  pdf/po-document.tsx — PDF layout (Sarabun font from public/fonts)
  crypto/secrets.ts  — AES-256-GCM (SMTP password encryption)
  utils/image.ts     — Browser image compression (HEIC → JPEG)
  csv/parse.ts       — RFC4180-ish CSV parser (+13 unit tests)
  types/db.ts        — all shared types

components/
  ui/                — shadcn primitives + custom:
                       status-pill, confirm-dialog, user-avatar, empty-state,
                       lookup-combobox, supplier-combobox, image-lightbox (with slideshow)
  po/                — po-row, workflow-timeline
  search-modal.tsx

instrumentation.ts   — Sentry init (Node + Edge runtimes)
sentry.client.config.ts / sentry.server.config.ts / sentry.edge.config.ts
```

---

## Navigation (5 dropdown groups)

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
| `equipment-images` | Equipment + custom item photos | Yes (ensureBucket) |
| `delivery-images` | Photos when receiving stock | Yes |
| `po-attachments`  | PDF/Word/Excel attached to PO | Yes — **public bucket (M6 todo: signed URL migration)** |

`ensureBucket()` in `lib/actions/upload.ts` — race-safe, idempotent.
Image upload verifies magic bytes (JPEG/PNG/GIF/WEBP) — prevents rename attack.

---

## Tables + Migrations (idempotent — รันซ้ำได้)

| Table / Change | Purpose | Migration file |
|---|---|---|
| `suppliers` | ผู้ผลิต/ผู้ขาย (full CRUD with bank/contact/payment) | `202604_suppliers.sql` |
| `lookups` | Generic dropdown (5 types) | `202604_lookups.sql` |
| `po_deliveries.uq_po_deliveries_no` | UNIQUE constraint (race-safe) | `202604_workflow_atomic.sql` |
| `users.role CHECK` | Allow "supervisor" | `202604_role_supervisor.sql` |
| `company_settings.smtp_*` | SMTP fields | `202604_email_settings.sql` |
| `users.notification_prefs` | JSONB pref per user | `202604_notification_prefs.sql` |
| `notification_prefs` defaults backfill | email_po_status_change=true + email_new_po | `202604_email_status_defaults.sql` |
| `lots` + `withdrawals.lot_id` | Lot/Batch tracking | `202604_lots.sql` |
| `purchase_orders.attachment_urls` + missing columns | discount/shipping_fee/vat/etc. | `202605_po_missing_columns.sql` |
| `purchase_orders.last_close_reminder_sent_at` | Throttle close-reminder cron | `202605_close_reminder_throttle.sql` |
| `withdraw_stock` RPC + `po_counters` + `next_po_number` RPC | Atomic stock + PO number | `202605_atomic_rpcs.sql` |
| **Data API grants to service_role + RLS enable + future defaults** | Prep for Supabase 30-Oct-2026 enforcement | `202605_data_api_grants.sql` |
| **`lot_status_enforce` trigger + backfill** | Auto-update lots.status (F2) | `202605_lots_auto_status.sql` |
| **`withdrawal_lot_usage` table + `withdraw_atomic` RPC** | Multi-lot FIFO trace + true atomic withdraw (F1+F3) | `202605_withdraw_atomic.sql` |

**FK link**: `purchase_orders.supplier_id → suppliers.id` (auto-set by orderPoAction via name lookup)
**Sequence**: `lot_no_seq` — generates `LOT-YYYY-NNNNN` via `next_lot_no()` RPC

## RPCs (Postgres functions)

| Function | Purpose | Migration |
|---|---|---|
| `withdraw_stock(p_equipment_id, p_qty)` | **Atomic** check + decrement (returns JSONB) — fallback | `202605_atomic_rpcs.sql` |
| `withdraw_atomic(p_equipment_id, p_qty, p_user_id, ...)` | **F1 — true atomic**: stock + withdrawal + FIFO lots ใน tx เดียว | `202605_withdraw_atomic.sql` |
| `next_po_number(year_int)` | **Atomic** PO number via counter table + advisory lock | `202605_atomic_rpcs.sql` |
| `lot_status_enforce()` | **Trigger function** auto status='depleted/expired/active' | `202605_lots_auto_status.sql` |
| `increment_equipment_stock(p_id, p_qty)` | Atomic stock +/- (signed qty) | `202604_workflow_atomic.sql` |
| `next_po_delivery_no(p_po_id)` | Atomic delivery_no via advisory lock | `202604_workflow_atomic.sql` |
| `next_lot_no()` | Returns `LOT-YYYY-NNNNN` | `202604_lots.sql` |
| `update_suppliers_updated_at` / `update_lookups_updated_at` / `update_lots_updated_at` | Trigger functions | each table's migration |

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

### Functions in `lib/email/index.ts`
1. **`sendWelcomeEmail`** — new user creation (Username + temp password)
2. **`sendDailyDigest`** — admin daily summary (cron 08:00 ICT, filter by `email_daily_digest` pref)
3. **`sendPoUpdateEmail`** — PO transitions (8 kinds: ordered/shipping/completed/cancelled/issue/close_reminder/**reverted**/new_for_admin)

### `resolveBaseUrl()` priority
```
1. opts.appUrl (override)
2. NEXT_PUBLIC_APP_URL (recommend — explicit)
3. VERCEL_PROJECT_PRODUCTION_URL (auto, production alias)
4. VERCEL_URL (auto, deployment-specific — SSO protected!)
5. http://localhost:3000 (dev)
```
⚠️ Never rely on VERCEL_URL — preview deployments have SSO.

### `sanitizeSubject()` helper
Strips CRLF + control chars + collapses whitespace + max 200 chars.
Used in ALL email subjects (defense in depth against header injection).

### PO status email triggers (sent to **creator** only)
| Transition | Email kind | Body content |
|---|---|---|
| → "สั่งซื้อแล้ว" | `ordered` | "คาดว่าจะได้รับ {date}" (no supplier name) |
| → "กำลังขนส่ง" | `shipping` | "Supplier ส่งของแล้ว — เตรียมรับของได้" (no tracking) |
| → "เสร็จสมบูรณ์" | `completed` | "ปิดงานเรียบร้อย" |
| → "ยกเลิก" | `cancelled` | "โดย {user} • {reason}" |
| → "มีปัญหา" | `issue` | "แจ้งโดย {user} • {issue}" |
| (cron) ค้างไม่ปิด > 1 วัน | `close_reminder` | "ค้าง {N} วัน — กรุณาปิดงาน" (throttle 3 days) |
| **↩️ Revert status** | **`reverted`** | "{from} → {to} • โดย {user} • {reason}" (F6) |

### Admin email trigger
- **New PO created** → `new_for_admin` template → all admin/supervisor with `email_new_po=true`

### Per-user prefs (`users.notification_prefs` JSONB)
- `email_daily_digest` (default true)
- `email_po_status_change` (default true)
- `email_new_po` (default true)
- `inapp_po_status_change` / `inapp_po_cancelled` / `inapp_new_po` (default true)

UI: `/preferences` (all users) — Switch toggles, save bar

---

## Multi-Delivery Receive Flow (commit e7e743e)

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

### Auto-create lots (with unit map)
After successful delivery insert → `createLotsForDelivery()` creates 1 `lot` row per equipment line:
- Pre-fetches `equipment.unit` map (so `lots.unit` is populated correctly)
- Records `qty_initial = qty_remaining = qty_received`
- Status `active`
- Best-effort — doesn't block flow if lots table missing

---

## Withdrawal Flow (atomic — F1 + F3)

### Primary path: `withdraw_atomic` RPC
Single Postgres transaction:
```
withdraw_atomic(equipment_id, qty, user_id, ...)
├─ UPDATE equipment.stock (atomic check + decrement)
├─ INSERT withdrawals (without lot_id)
├─ FIFO LOOP:
│  ├─ UPDATE lots.qty_remaining (trigger handles status — F2)
│  └─ INSERT withdrawal_lot_usage (F3 — track each lot)
└─ UPDATE withdrawals.lot_id = primary (backward compat)
```

Returns JSONB `{ success, withdrawal_id, lot_usages[], unallocated, ... }`

If any step fails → rollback ทั้งหมด (true atomicity)

### Fallback path
ถ้า `withdraw_atomic` ไม่อยู่ (migration ยังไม่รัน):
→ ใช้ legacy `withdraw_stock` RPC + manual FIFO ใน app code

### `withdrawal_lot_usage` table (F3)
Multi-lot consumption tracking:
- 1 withdrawal → N rows (each lot used)
- `deleteWithdrawalAction` คืน qty ให้ทุก lot ที่ใช้ (ไม่ใช่แค่ primary)
- Trigger F2 จัดการ status='active'/'depleted' อัตโนมัติ

### Use case
เบิก 100 ขวด:
- Lot A เหลือ 60 (รับเข้าก่อน) → กิน 60
- Lot B เหลือ 50 → กิน 40
- `withdrawal_lot_usage`: 2 rows
- ถ้า delete withdrawal → คืน A=60, B=40 อัตโนมัติ ✓

---

## Lot/Batch Tracking (Phase E — commit ddbd41c)

### Schema (`migrations/202604_lots.sql`)
- `lot_no` (auto via `next_lot_no()`) — format `LOT-YYYY-NNNNN`
- Provenance: `po_id`, `po_number` (snapshot), `po_delivery_id`, `supplier_name`, `supplier_lot_no`
- Dates: `manufactured_date`, `expiry_date`, `received_date`
- Status: `active` | `depleted` | `expired` | `discarded`
- `withdrawals.lot_id` (FK)

### FIFO consumption
**Primary (F1 — atomic RPC):** `withdraw_atomic()` handles end-to-end in transaction
**Fallback:** app-side FIFO loop in `withdraw.ts`

Both paths:
1. Query active lots of equipment, sorted by `received_date` ASC
2. Decrement `qty_remaining` across lots (oldest first)
3. **F2 trigger** auto-sets status='depleted' when reaches 0
4. **F3** stores ALL lots used in `withdrawal_lot_usage` table (not just primary)

### Auto status enforcement (F2 — trigger)
`BEFORE INSERT OR UPDATE ON lots` trigger enforces:
- `qty_remaining <= 0` → 'depleted'
- `qty_remaining > 0 + status=depleted` → 'active' (restore)
- `expiry_date < today + status=active` → 'expired'
- `status=discarded` → keep (admin override)

Daily cron `/api/cron/close-reminder` also flips expired lots ที่นิ่ง

### Pages
- **`/lots`** — list with 4 KPI cards (by status) + filter: status / search / expiring 7d / 30d
- **`/lots/[id]`** — detail: 3 stats + provenance grid + edit dialog + withdrawal history
- **`LotEditClient`** — admin/supervisor edits supplier_lot_no, manufactured/expiry dates, notes

---

## Revert Status Workflow (commit 6cf040e)

Admin/Supervisor สามารถย้อนสถานะกลับ 1 step ผ่าน "↩️ ย้อนสถานะ" button:

| จาก | ย้อนเป็น | Rollback |
|---|---|---|
| สั่งซื้อแล้ว | รอจัดซื้อ | Clear supplier + ราคา + วันที่ + items[].unit_price=0 |
| กำลังขนส่ง | สั่งซื้อแล้ว | Clear tracking_number |
| รับของแล้ว/มีปัญหา | กำลังขนส่ง | Delete last delivery + rollback stock + delete lots (block ถ้ามี withdrawals หรือ >1 delivery) |
| เสร็จสมบูรณ์ | รับของแล้ว | Status only (keep deliveries) |
| รอจัดซื้อ / ยกเลิก | — | ไม่ revert ได้ |

### Safety
- Privileged only
- Check withdrawals.lot_id references before revert (block)
- Check delivery count > 1 → block (asymmetric rollback prevention)
- Require reason text
- Audit log: `"ย้อน: X → Y | reason | details | snapshot={...JSON}"` (F4)
- Email notify creator: kind="reverted" (F6)

### F4 — Audit snapshot
Before clearing data, pre-revert values stored as JSON in activity description:
```
Case 1 (สั่งซื้อแล้ว → รอจัดซื้อ):
  supplier_name, contact, dates, totals, item_prices[]
Case 2 (กำลังขนส่ง → สั่งซื้อแล้ว):
  tracking_number
```
Admin สามารถ trace ค่าเก่า + manual recover ได้ใน /audit page

---

## Bulk Delete PO (commit 702300a)

Privileged only — `/po` page row checkboxes + sticky action bar.

**Deletable statuses (only):**
- `รอจัดซื้อดำเนินการ` (draft)
- `ยกเลิก` (archive)

**NOT deletable:**
- เสร็จสมบูรณ์ — business record preservation
- Active workflow (สั่งซื้อ/กำลังขนส่ง/รับของ/มีปัญหา) — must cancel/close first

**Cascade delete:**
- `po_activities`, `po_comments`, `po_deliveries`, `notifications` (referencing PO)
- `lots.po_id` → SET NULL (preserve lot history)

**Limit:** 100 POs/request

---

## CSV Import (Phase C — commit a4b92f2)

### `lib/csv/parse.ts` — minimal RFC 4180 parser
- Quoted fields with commas / embedded quotes / embedded newlines
- BOM strip, CRLF/LF
- 13 unit tests

### `bulkCreateEquipmentAction(rows)`
- Pre-fetch existing names → case-insensitive dedup
- In-batch dedup
- **Validation (after audit)**: length limits (name 200, category 80, desc 1000)
  + numeric clamps (max 99M) + safeText() prepend `'` for `=/+/-/@` (formula injection guard)
- Insert chunks of 100
- Limit 5,000 rows/file
- Returns `{ inserted, skipped, failed, failedReasons }`

### UI: `BulkImportDialog` (3-step wizard)
- Upload (drag-pick + template download)
- Preview (table 200 first rows + per-row validation badges)
- Done (summary)

---

## Image Lightbox + Slideshow (commit 7fb8f08)

Shared component: `components/ui/image-lightbox.tsx`

**Features:**
- Fullscreen backdrop + blur
- Navigation ← → (keyboard + buttons)
- **Slideshow auto-advance** (default 3 วินาที/รูป)
  - Play/Pause button + Spacebar shortcut
  - Auto-pause on manual nav
  - Progress bar (animated 0→100%)
- Thumbnail strip below
- Click outside / Esc = close
- Optional download button
- Optional title + meta

**Used in:**
- `AttachmentsSection` (PO attachments — รูปใน order/shipping/general)
- `DeliveriesList` (delivery photos)

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
- Without DSN → graceful no-op

---

## Security Layer (sum of audit fixes)

| Layer | Mechanism |
|---|---|
| Auth | Cookie session + bcrypt cost 14 + 5/15min lockout |
| Permission gates | requireUser/requireAdmin/requirePrivileged on pages + per-action checks |
| Attachment perm | privileged OR creator + non-terminal status (lib/actions/po.ts) |
| Comment perm | must see PO (privileged/creator/team-visible) + 2000 char limit |
| Image upload | magic bytes verify (FF D8 / 89 50 / 47 49 / RIFF...WEBP) |
| CSV import | length limits + numeric clamps + formula-injection guard (safeText) |
| CSV export | formula-injection escape (prepend `'` for `=/+/-/@/\t/\r`) |
| Email subject | sanitizeSubject() — strip CRLF + control chars + max 200 chars |
| SMTP password | AES-256-GCM encryption via ENCRYPTION_KEY |
| Cron auth | Bearer CRON_SECRET (rejects all if not set) |
| Sensitive fields | hidden from non-admin (prices, supplier contact, procurement notes) |

### Atomic operations (no race condition)
- `withdraw_stock` RPC — UPDATE...WHERE stock>=qty RETURNING in single statement
- `next_po_number` RPC — counter table + advisory lock (per year)
- `increment_equipment_stock` RPC — signed qty +/- atomic
- `next_po_delivery_no` RPC — advisory lock + unique constraint

---

## Recent design decisions

### Number input UX (commits 3f47f10 + e53487e + 2284c6c)
Pattern for ALL `type="number"` controlled inputs:
```tsx
value={x === 0 ? "" : x}                       // empty when 0 (placeholder shows "0")
placeholder="0"
onFocus={(e) => e.currentTarget.select()}      // click → select all → type replaces
```
Fixes: leading-zero React quirk ("01" displayed because input.valueAsNumber == state).

### Thai font handling (IMPORTANT)
- Sarabun loaded weights **400-800** (was 400-700; `font-extrabold` requires 800)
- **DO NOT use `font-black`** (weight 900 not loaded → fake-bold breaks Thai)
- **DO NOT apply `tracking-[X]em` (>0.05em) to Thai text**
- Global CSS in `globals.css` caps tracking for `:lang(th)` elements

### UX patterns
- **Destructive actions** → `<ConfirmDialog>` modal (with optional reason textarea)
- **Success feedback** → `toast.success()` (non-blocking)
- **Errors** → `toast.error()` for transient, `<Alert>` for persistent
- **Forms** → `router.refresh()` after submit (ทุก form ใน /po/[id])
- **Image lightbox** on equipment grid + items list + delivery + attachments
- **Multi-image cards**: 1 primary + 3 thumbs; "+N รูปเพิ่ม" overlay if more

### Performance wins
- **Charts lazy-loaded** via `next/dynamic(... ssr: false)`
- **React.cache() on every DB query** → layout + page hit DB once per request
- **Promise.all on multi-fetch pages**
- **Vercel sin1 region** (closer to Thai users + Supabase ap-southeast-1)
- **Loading skeletons** for every route
- **F5 — unstable_cache + revalidateTag** for global dropdown data:
  ```
  getCategories  → tag "categories"  (5 min TTL, invalidate on add/update/delete/move)
  getLookups     → tag "lookups"     (5 min TTL, invalidate on create/update/delete)
  getAllSuppliers → tag "suppliers"  (5 min TTL, invalidate on CRUD)
  ```
  → reduces Supabase load on /po/new, /suppliers, /equipment, /withdraw

### Keyboard shortcuts
```
/        focus search (synthesizes ⌘K)
N        new PO
G→D      dashboard
G→P      PO list
G→W      withdraw
?        help dialog
Esc      close modal (Radix native)
Space    lightbox: toggle slideshow play/pause
←/→      lightbox: navigate
```

### Standardized Thai phrases
- ✓ "คาดว่าจะได้รับ" (not "คาดได้" / "คาดได้รับ") — across all UI labels, emails, CSV
- ✓ "บาท" as KPI unit label, `฿` as inline currency prefix
- ✓ Date format `dd MMM yy` (Thai locale)

---

## Known caveats

### Force-dynamic everywhere
Most `(app)/*/page.tsx` exports `dynamic = "force-dynamic"`. Tradeoff: prevents Vercel edge caching.

### `*.vercel.app` Chrome warning
Custom domain solves this. Security headers in `next.config.ts` improve site reputation.

### `as never` casts in Supabase queries
Codebase uses untyped Supabase client → many `as never` casts. Future: generate types via `supabase gen types`.

### Email links require NEXT_PUBLIC_APP_URL
Without it, falls back through `VERCEL_PROJECT_PRODUCTION_URL` → `VERCEL_URL` (has SSO!) → localhost.
**Always set explicitly in Vercel.**

### `po-attachments` bucket is still public
Migration to signed URLs deferred (would break existing public URL references in attachment_urls JSONB).
Risk: low — file names are random hash, hard to guess.

---

## Pending / open work

### ✅ Completed (Audit rounds 1+2 + Future Iterations F1-F6)
- All Critical (5) + High (12) + Medium (7) audit issues resolved
- F1: Atomic withdraw RPC ✓
- F2: Lot status auto-enforce trigger ✓
- F3: withdrawal_lot_usage multi-lot trace ✓
- F4: Revert audit JSON snapshot ✓
- F5: unstable_cache + revalidateTag pattern ✓
- F6: PoEmailKind="reverted" + email notify ✓

### Still pending (refactor work — design sprint candidates)
- **M3: Hardcoded colors** — 191 จุด — design system v2
- **M6: po-attachments signed URL migration** — careful migration needed (rewrite stored URLs in DB)
- **L1: Test coverage** — server actions ไม่มี unit test (po/equipment/lot/withdraw)
- **L3: ISR migration** — force-dynamic → revalidate 60s on dashboard/budget/reports
  (note: cookies() blocks ISR — would need refactor to use unstable_cache more aggressively)

### Performance audit findings (TOP not yet fixed)
1. 🔴 `select("*")` on hot paths → explicit columns (-25% bandwidth)
2. 🔴 N+1 in `calculateActualSpending` (budget) → SQL JOIN
3. 🟡 Suspense boundaries on PO detail (stream activities/comments)
4. 🟡 `optimizePackageImports` in next.config (@radix-ui, lucide-react, recharts)

### Nice-to-have
- Print-friendly route `/po/[id]/print`
- Custom domain (replaces *.vercel.app warning)
- Rate limiting (Upstash KV) on login + create PO
- Submit Safe Browsing review for the deployed URL
- Expiring lots dashboard alert (`getExpiringSoonCount()`)
- FIFO suggestion UI in withdraw form (preview lots that will be consumed)

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
NEXT_PUBLIC_SUPABASE_ANON_KEY     # or sb_publishable_... (new format)
SUPABASE_SERVICE_ROLE_KEY         # or sb_secret_... (new format)
NEXT_PUBLIC_APP_URL               # ⚠️ Set explicitly!

# SMTP (optional — admin can set in /settings UI)
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD
FROM_EMAIL / FROM_NAME

# Security (recommended)
CRON_SECRET                       # /api/cron/* — REJECTS if not set
ENCRYPTION_KEY                    # 32 bytes hex (openssl rand -hex 32)
NEXT_PUBLIC_SENTRY_DSN            # Sentry — graceful no-op if missing
```

---

## Working style

- All session work on `main` branch with direct push.
- Commit messages: descriptive subject + bullet body. `Co-Authored-By: Claude` trailer.
- No PR workflow — `git push` after every meaningful change.
- Toast / ConfirmDialog patterns consistent.
- Thai UI labels except eyebrow labels (PO PRO, SUPPLIER, etc.).
- **Migration files: idempotent** (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DO $$ IF NOT EXISTS $$`).
- **New tables ใน migrations** — ต้องเพิ่ม GRANT + RLS หลัง CREATE (Supabase 30-Oct-2026):
  ```sql
  CREATE TABLE IF NOT EXISTS public.new_table (...);
  GRANT ALL ON public.new_table TO service_role;
  ALTER TABLE public.new_table ENABLE ROW LEVEL SECURITY;
  -- หรือพึ่ง ALTER DEFAULT PRIVILEGES ใน 202605_data_api_grants.sql
  -- (default privileges จะใช้กับ table ที่สร้างใหม่หลัง migration นั้นรัน)
  ```
- Server actions: best-effort secondary actions (email, lot creation) wrapped in try/catch — never block primary flow.
- Diagnostic logs: `console.log("[module name]")` for grep filter in Vercel logs.
- Defense in depth: validate at client AND server (e.g., qty_damaged > qty_received).
- Privacy: hide sensitive info from non-admin (prices, supplier name in emails, etc.)

### CRITICAL: Working directory awareness when committing
Parent project is at `/Users/anavinst/Downloads/lab-parfumo-po-main-setup/` (myproject.git).
Lab-parfumo-next repo is in subdirectory `lab-parfumo-next/` (lab-parfumo-next.git).
**Always `cd` into `lab-parfumo-next/` before `git` commands** — accidentally committing
in parent caused a Supabase key leak (rotated 2026-05-13).

---

## Quick git context

```bash
git log --oneline -30
```

## Useful debugging SQL

```sql
-- Unlock locked-out user (5 fail/15min lockout)
DELETE FROM login_attempts WHERE username = 'X' AND success = false AND created_at > NOW() - INTERVAL '15 minutes';
UPDATE users SET failed_login_count = 0 WHERE username = 'X';

-- Reset password via SQL
UPDATE users SET password_hash = crypt('NEWPASS', gen_salt('bf', 14)), failed_login_count = 0 WHERE username = 'X';

-- Verify password matches
SELECT username, (password_hash = crypt('PASS', password_hash)) AS ok FROM users WHERE username = 'X';

-- Check notification prefs
SELECT username, email, notification_prefs FROM users;

-- Recent notifications (debug noti flow)
SELECT n.title, u.username, u.email, n.created_at
FROM notifications n LEFT JOIN users u ON u.id = n.user_id
ORDER BY n.created_at DESC LIMIT 10;

-- Audit attachments
SELECT po_number, status, jsonb_array_length(COALESCE(attachment_urls, '[]'::jsonb)) AS att_count
FROM purchase_orders ORDER BY created_at DESC LIMIT 10;

-- Force update qty in PO (mid-workflow change — careful with stock implications)
UPDATE purchase_orders SET items = (
  SELECT jsonb_agg(
    CASE WHEN elem->>'name' ILIKE '%NAME%'
      THEN jsonb_set(jsonb_set(elem, '{qty}', 'NEW_QTY'::jsonb), '{subtotal}', ...)
      ELSE elem END
  ) FROM jsonb_array_elements(items) elem
) WHERE po_number = 'PO-XXXX-XXXX';

-- Check active lots
SELECT lot_no, equipment_name, qty_initial, qty_remaining, status, expiry_date
FROM lots WHERE status = 'active' ORDER BY received_date DESC LIMIT 20;
```
