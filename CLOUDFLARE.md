# Deploy บน Cloudflare Workers (OpenNext)

คู่มือ deploy `lab-parfumo-next` ขึ้น **Cloudflare Workers** ด้วย OpenNext
(branch `cloudflare` — `main` ยังคง deploy บน Vercel ตามเดิม ไม่กระทบกัน)

> ทำไมต้องแก้: Cloudflare Workers รัน SMTP (nodemailer) ไม่ได้ + อ่าน filesystem
> (ฟอนต์ PDF) ไม่ได้ จึงต้องเปลี่ยน 2 จุดนี้ให้ทำงานผ่าน HTTP แทน

---

## สิ่งที่เปลี่ยนใน branch นี้

| จุด | เดิม (Vercel) | ใหม่ (Cloudflare) |
|---|---|---|
| อีเมล | SMTP ผ่าน nodemailer | **Resend HTTP API** (auto ถ้ามี `RESEND_API_KEY`) |
| ฟอนต์ PDF | อ่านจาก filesystem | **โหลดผ่าน HTTPS** (ถ้าตั้ง `PDF_FONT_BASE_URL`) |
| Build | `next build` | `opennextjs-cloudflare build` |
| Cron | `vercel.json` crons | external scheduler / cron worker (ดูล่าง) |

โค้ดเป็น **hybrid** — ไม่มี env พวกนี้ก็ fallback กลับไปพฤติกรรมเดิม (Vercel ไม่พัง)

---

## 1) Environment variables ที่ต้องตั้งบน Cloudflare

ตั้งใน **Workers & Pages → (โปรเจกต์) → Settings → Variables and Secrets**
(ประเภท **Secret** สำหรับค่าที่เป็นความลับ)

**จำเป็น (Supabase — เหมือน Vercel):**
```
NEXT_PUBLIC_SUPABASE_URL        = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = <anon key>
SUPABASE_SERVICE_ROLE_KEY       = <service role key>
```

**อีเมล (Resend) — ต้องมีถ้าจะส่งอีเมล:**
```
RESEND_API_KEY      = re_xxxxxxxx           # จาก https://resend.com/api-keys
RESEND_FROM_EMAIL   = noreply@yourdomain.com # โดเมนต้อง verify ใน Resend ก่อน
RESEND_FROM_NAME    = Lab Parfumo PO         # (ไม่ใส่ก็ได้)
```
> ทดสอบก่อน verify โดเมน: ตั้ง `RESEND_FROM_EMAIL=onboarding@resend.dev`
> (ส่งได้เฉพาะถึงอีเมลเจ้าของบัญชี Resend)

**PDF (ฟอนต์ไทย) — ต้องมี ไม่งั้น PDF ตัวหนังสือหาย:**
```
PDF_FONT_BASE_URL   = https://<โดเมนที่ deploy>   # เช่น https://lab-parfumo-next.<subdomain>.workers.dev
```
> ค่านี้ต้องเป็น URL ของแอปเอง (ฟอนต์เสิร์ฟที่ `/fonts/*.ttf`) — deploy ครั้งแรก
> ให้รู้โดเมนก่อน แล้วค่อยมาตั้งค่านี้ + redeploy

**ลิงก์ในอีเมล + ทั่วไป:**
```
NEXT_PUBLIC_APP_URL = https://<โดเมนที่ deploy>
CRON_SECRET         = <สุ่มยาวๆ>              # ใช้กับ cron endpoints
ENCRYPTION_KEY      = <ถ้าใช้ encrypt secrets ใน DB>
```

---

## 2) Deploy

### วิธี A — ผ่าน Dashboard (เชื่อม GitHub, แนะนำ)

1. **Workers & Pages → Create → Workers → เชื่อม repo `anavin/lab-parfumo-next`**
2. เลือก branch = **`cloudflare`**
3. ตั้ง build:
   - **Build command:** `npx opennextjs-cloudflare build`
   - **Deploy command:** `npx wrangler deploy`
4. ใส่ env vars จากข้อ 1
5. Deploy → ได้โดเมน `*.workers.dev`
6. กลับมาตั้ง `PDF_FONT_BASE_URL` + `NEXT_PUBLIC_APP_URL` = โดเมนนั้น → redeploy

### วิธี B — จากเครื่อง (CLI)

```bash
cd lab-parfumo-next
npx wrangler login          # ครั้งแรกครั้งเดียว
npm run cf:deploy           # build + deploy
```
ตั้ง secret ผ่าน CLI:
```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put RESEND_API_KEY
# ... ตัวอื่นๆ
```

### ทดสอบ local ก่อน deploy
```bash
npm run cf:preview   # build + รัน worker ที่ http://localhost:8788
```
> local อ่าน env จากไฟล์ `.dev.vars` (สร้างจาก `.env.local` — ไฟล์นี้ถูก gitignore แล้ว)

---

## 3) Cron (อีเมลสรุปรายวัน)

มี 2 endpoint (auth ด้วย `Authorization: Bearer $CRON_SECRET`):
- `GET /api/cron/daily-digest` — สรุปประจำวัน (เดิม 08:00 ICT = 01:00 UTC)
- `GET /api/cron/daily-tasks`  — เตือนงานค้าง (เดิม 09:00 ICT = 02:00 UTC)

OpenNext worker ไม่รองรับ `scheduled()` handler ในตัว → เลือก 1 วิธี:

**วิธีที่ 1 — External scheduler (ง่ายสุด, ฟรี)**
ใช้ [cron-job.org](https://cron-job.org) (ฟรี) สร้าง 2 job:
- URL: `https://<โดเมน>/api/cron/daily-digest` — schedule 01:00 UTC
- Header: `Authorization: Bearer <CRON_SECRET>`
- ทำซ้ำสำหรับ `daily-tasks` ที่ 02:00 UTC

**วิธีที่ 2 — Cloudflare Cron Worker แยก (native, ฟรี)**
สร้าง worker เล็กๆ อีกตัวที่มี `scheduled()` handler แล้ว fetch ไปที่ 2 endpoint
พร้อม header `CRON_SECRET` — ตั้ง `triggers.crons` ใน wrangler ของ worker ตัวนั้น

---

## หมายเหตุ / ข้อควรระวัง

- **PDF (@react-pdf/renderer)** — dependency ถูก bundle เข้า worker แล้ว แต่ยัง
  **ต้องทดสอบ runtime จริงหลัง deploy** (login → เปิด PO → กดดาวน์โหลด PDF)
  ตรวจว่าตัวหนังสือไทยขึ้นครบ ถ้าฟอนต์หาย = ตรวจ `PDF_FONT_BASE_URL`
- **หน้าตั้งค่า SMTP ใน admin** — ยังอยู่แต่ไม่มีผลเมื่อใช้ Resend (Resend อ่านจาก
  env) จะเก็บไว้เป็น fallback หรือซ่อน UI ทีหลังก็ได้
- ไฟล์ build (`.open-next/`), `.dev.vars`, `cloudflare-env.d.ts` ถูก gitignore แล้ว
