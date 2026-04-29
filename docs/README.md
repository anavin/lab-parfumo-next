# 📚 Lab Parfumo PO Pro — Documentation

> เอกสารทั้งหมดสำหรับทีม Lab Parfumo

---

## 📖 คู่มือผู้ใช้ (User Guides)

### สำหรับ User ใหม่
**[QUICK-START.md](./QUICK-START.md)** — Quick reference 1 หน้า
- Login ครั้งแรก + เปลี่ยน password
- เมนูหลัก
- 3 tasks ที่ใช้บ่อยสุด
- FAQ พื้นฐาน

### สำหรับใช้งานเต็ม
**[USER-GUIDE.md](./USER-GUIDE.md)** — คู่มือเต็ม (26 sections)
- ทุก task ครบถ้วน + step-by-step
- แยกตาม role (Staff / Supervisor / Admin)
- Visual mockups + tips
- FAQ + Troubleshooting

---

## 📊 เปรียบเทียบ

|  | Quick Start | Full User Guide |
|---|---|---|
| **ความยาว** | ~1 หน้า | ~26 sections |
| **เวลาอ่าน** | 3-5 นาที | 30-45 นาที |
| **เหมาะกับ** | User ใหม่ — overview ทันที | ใช้เป็น reference เวลาทำงาน |
| **รวมอะไร** | 3 tasks หลัก + FAQ | ทุก task ทั้งระบบ |
| **Print** | 1 หน้า | ~15 หน้า |

---

## 🚀 แนะนำการใช้

### สำหรับ User ใหม่ (วันแรก)
1. อ่าน **QUICK-START.md** ก่อน (3 นาที)
2. ลอง login + เปลี่ยน password
3. ลองสร้าง PO 1 ใบ
4. ดูคู่มือเต็มเฉพาะ task ที่จะใช้

### สำหรับ Admin / Supervisor
1. อ่าน **USER-GUIDE.md** sections 14-22 (privileged tasks)
2. เก็บไว้ใช้ reference เมื่อมี user ถาม

### สำหรับ Onboarding ทีม
1. ส่ง **QUICK-START.md** ในไลน์ทีม / email
2. แชร์ link **USER-GUIDE.md** ในไฟล์อ้างอิง
3. นัดเทรน 30 นาทีพร้อม screenshot จริง (ถ้าต้องการ)

---

## 📋 Roles ในระบบ

| Role | Icon | ใครได้ | สิทธิ์โดยย่อ |
|---|---|---|---|
| 👑 **Admin** | Crown ทอง | Top management | ทำได้ทุกอย่าง + ตั้งค่าระบบ |
| 🛡️ **Supervisor** | ShieldCheck น้ำเงินม่วง | Senior staff | เหมือน admin ยกเว้น settings + จัดการ admin user |
| 👤 **Staff** | Shield เทา | พนักงานทั่วไป | สร้าง PO, รับของ, เบิกของ |

---

## 🔧 Technical Documentation

- [`/CLAUDE.md`](../CLAUDE.md) — สำหรับ developer (Claude Code memory)
- [`/migrations/`](../migrations/) — Database migrations (รัน manual ใน Supabase)
- [`/scripts/`](../scripts/) — One-time scripts (เช่น add-users.mjs)

---

## 📝 อัปเดต / แก้คู่มือ

ถ้าต้องการแก้ — แก้ไฟล์ markdown ตรงๆ + commit:

```bash
cd lab-parfumo-next
# แก้ไฟล์ใน docs/
git add docs/
git commit -m "Docs: update X"
git push
```

---

**อัปเดตล่าสุด**: เมษายน 2569
