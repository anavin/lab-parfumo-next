# Lab Parfumo PO — Next.js Edition 🚀

ระบบ Purchase Order ของ Lab Parfumo ที่เขียนใหม่ด้วย **Next.js 15 + TypeScript + Tailwind + Supabase**

## 🎯 Phase 1 (Foundation) — สิ่งที่ทำเสร็จแล้ว

- ✅ Next.js 15 (App Router) + React 19 + TypeScript
- ✅ Tailwind CSS + Lab Parfumo brand colors
- ✅ Auth ด้วย bcrypt + session cookie (รองรับ user เดิมจาก Streamlit)
- ✅ Auto-upgrade SHA-256 → bcrypt (เหมือน Python)
- ✅ Account lockout (5 ครั้ง / 15 นาที)
- ✅ Login page + Change password page
- ✅ Protected routes (middleware)
- ✅ App layout + Header navigation (responsive)
- ✅ Dashboard skeleton (KPI hero + stats grid)
- ✅ ฟอนต์ Sarabun (รองรับภาษาไทย)
- ✅ Mobile-first responsive

## 🚧 Phase ที่กำลังจะมา

- [ ] Phase 2: Dashboard เต็ม (charts, action items, alerts)
- [ ] Phase 3-4: PO List + Create + View + Procurement
- [ ] Phase 5: Receive PO + Delivery
- [ ] Phase 6: Equipment Catalog + Approval
- [ ] Phase 7: Withdrawals
- [ ] Phase 8: Budget + Reports + Export
- [ ] Phase 9: PDF Generator + Email + Notifications
- [ ] Phase 10: Polish + Deploy Vercel

---

## 🛠 Setup

### 1. ติดตั้ง dependencies

ต้องการ **Node.js 20+** และ **pnpm** (หรือ npm/yarn):

```bash
cd lab-parfumo-next
npm install   # หรือ pnpm install
```

### 2. ตั้งค่า env

```bash
cp .env.local.example .env.local
```

เปิด `.env.local` แล้วใส่ค่าจาก Supabase project เดิม (อยู่ใน `secrets.toml` ของ Streamlit):

```env
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."   # ⚠️ ใหม่ — Service role key
```

> 💡 **Service role key** อยู่ที่ Supabase → Settings → API → "service_role secret"

### 3. ใช้ Database เดิม (ไม่ต้อง migrate)

Next.js เวอร์ชันนี้ **ใช้ database เดียวกับ Streamlit ทุกประการ** — login user เดิม, PO เดิม, equipment เดิม

ไม่ต้องรัน migration ใหม่ — ใช้ schema ที่มีอยู่ได้เลย

### 4. รัน dev server

```bash
npm run dev
```

เปิด <http://localhost:3000> → จะ redirect ไป `/login`

ใช้ username/password เดิมจาก Streamlit ได้เลย

---

## 📁 โครงสร้าง

```
lab-parfumo-next/
├── app/
│   ├── (app)/                  # Protected routes (auth required)
│   │   ├── _components/        # Header + nav links
│   │   ├── dashboard/          # Dashboard
│   │   └── layout.tsx          # Protected layout
│   ├── change-password/        # บังคับเปลี่ยนรหัสครั้งแรก
│   ├── login/                  # Login (public)
│   ├── globals.css             # Tailwind + theme
│   ├── layout.tsx              # Root layout (Sarabun font)
│   └── page.tsx                # "/" → redirect login or dashboard
├── components/
│   └── ui/                     # Button, Input, Card, Alert
├── lib/
│   ├── auth/
│   │   ├── login.ts            # bcrypt verify + lockout
│   │   ├── logout.ts           # logout server action
│   │   ├── password.ts         # hash/verify/validate
│   │   └── session.ts          # session cookie helpers
│   ├── supabase/
│   │   ├── server.ts           # admin client (service role)
│   │   └── browser.ts          # browser client (anon)
│   ├── types/
│   │   └── db.ts               # TypeScript schema types
│   └── cn.ts                   # className utility
├── middleware.ts               # auth protection
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 🚀 Deploy ไป Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd lab-parfumo-next
vercel

# Production
vercel --prod
```

หรือผ่าน Web UI:
1. Push folder นี้ไป GitHub
2. ไปที่ <https://vercel.com> → New Project
3. Import repo → เลือก **Root Directory: `lab-parfumo-next`**
4. ตั้ง env variables (3 ตัวจาก `.env.local`)
5. Deploy!

⚠️ Vercel Free tier มีข้อจำกัด:
- Serverless function execution time: 10s (เพียงพอ)
- 100GB bandwidth/month (เพียงพอสำหรับ internal use)

---

## 🔄 Migration จาก Streamlit

Streamlit version จะยังรันต่อ — Next.js เป็นแยกโปรเจกต์ที่ใช้ **DB เดียวกัน**

แนวทาง:
1. Deploy Next.js → ทดสอบในกลุ่ม admin
2. ถ้าโอเค → broadcast URL ใหม่ไปยังทีม
3. ระยะ transition: ใช้ทั้ง 2 ระบบขนานกัน
4. หลัง stable แล้ว → shutdown Streamlit

---

## 🐛 Troubleshooting

### "Missing Supabase env vars"
ตรวจ `.env.local` มี 3 ตัวครบ + restart `npm run dev`

### "ไม่สามารถสร้าง session ได้"
ตรวจ Supabase → Table Editor → `user_sessions` table มีอยู่ (รัน `migration_user_sessions.sql` แล้ว)

### Login ผ่านแต่ redirect loop
ตรวจ middleware + cookie — ลอง clear cookie แล้ว login ใหม่

### ฟอนต์ภาษาไทยแสดงผิด
รอโหลด Sarabun จาก Google Fonts — ครั้งแรกจะช้า ครั้งถัดๆ ไป cached แล้วเร็ว

---

## 📈 Performance Targets

| Metric | Streamlit | Next.js (target) |
|--------|-----------|-----------------|
| Cold start | 30-60s | 2-3s |
| Per-click | 1-3s | 100-300ms |
| Mobile UX | ปานกลาง | ดีมาก |
| SEO | ❌ | ✅ |

---

Made with ❤️ — Phase 1 of 10
