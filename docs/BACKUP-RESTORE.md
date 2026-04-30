# 💾 Backup & Restore Guide

> วิธีสำรอง + กู้คืนระบบ Lab Parfumo PO Pro

---

## 🎯 3 ชั้นของ Backup

| ชั้น | สิ่งที่ครอบคลุม | ใช้เมื่อ |
|---|---|---|
| 1️⃣ **Git Tag** | Source code | ต้องการ rollback code (deploy ใหม่ผิด) |
| 2️⃣ **DB Export (JSON)** | Data ใน Supabase | ต้องการกู้ข้อมูล (เผลอลบ/เสีย) |
| 3️⃣ **Supabase Snapshot** | DB + Storage | DR — disaster recovery (servers หาย) |

---

## 1️⃣ Git Tag (Code Backup)

### สร้าง Tag (ทำก่อนเพิ่ม feature ใหญ่)

```bash
git tag -a v1.0-pre-feature-name -m "ก่อน feature X — rollback ได้ที่นี่"
git push origin v1.0-pre-feature-name
```

### List tags
```bash
git tag -l
```

### Rollback ไปที่ tag (กรณี deploy ใหม่พัง)

```bash
# ดู tag ที่ต้องการ
git tag -l

# Rollback แบบไม่ลบ history (สร้าง revert commit)
git revert <hash-of-bad-commits>..HEAD

# หรือ rollback แบบ hard (ลบ commits ใหม่ออก)
git reset --hard v1.0-pre-supplier
git push --force origin main      # ⚠️ ไม่แนะนำ — เสี่ยง
```

### Tag ปัจจุบันในระบบ

```
v1.0-pre-supplier   — Backup ก่อนเพิ่มระบบ Supplier (30 เม.ย. 2569)
```

---

## 2️⃣ Database Export (JSON Backup)

### Backup (สร้าง snapshot ปัจจุบัน)

```bash
cd lab-parfumo-next
node scripts/backup-db.mjs
```

**ผลลัพธ์:**
```
backups/YYYY-MM-DD_HH-MM-SS/
  ├─ manifest.json           (metadata + counts)
  ├─ users.json              (15 users)
  ├─ purchase_orders.json    (28 POs)
  ├─ equipment.json          (11 items)
  ├─ po_deliveries.json
  ├─ po_activities.json
  ├─ po_comments.json
  ├─ withdrawals.json
  ├─ budget_periods.json
  ├─ notifications.json
  ├─ company_settings.json
  ├─ user_sessions.json
  └─ login_attempts.json
```

> ⚠️ Folder `backups/` อยู่ใน `.gitignore` — ไม่ commit ขึ้น git
> เก็บ backup ไว้ใน external storage (Google Drive / external disk)

### Backup แบบ custom path

```bash
node scripts/backup-db.mjs --output ~/Desktop/lp-backup-2026-04-30
```

### Restore (กู้คืน — ⚠️ DESTRUCTIVE)

**Dry-run (ทดสอบก่อน — ไม่เขียน DB):**
```bash
node scripts/restore-db.mjs backups/2026-04-30_01-59-29 --dry-run
```

**Restore จริง:**
```bash
node scripts/restore-db.mjs backups/2026-04-30_01-59-29
# → จะถาม: พิมพ์ "RESTORE" เพื่อยืนยัน
```

**Restore เฉพาะบาง table:**
```bash
node scripts/restore-db.mjs backups/2026-04-30_01-59-29 --tables=users,equipment
```

**Skip confirm (ใช้ใน script อัตโนมัติ):**
```bash
node scripts/restore-db.mjs backups/2026-04-30_01-59-29 --skip-confirm
```

### ⚠️ ข้อควรระวัง Restore

1. **Stop application ก่อน** — block writes ระหว่าง restore
   - Vercel: Settings → General → Pause Deployment
2. **Restore replace data ทั้งหมด** ใน table นั้น — data ใหม่หลัง backup จะ**หาย**
3. **Order สำคัญ** — script จะ restore parent table ก่อน child (เช่น users → purchase_orders → po_deliveries) ป้องกัน FK fail
4. **Logout ทุก user** หลัง restore — session อาจไม่ตรง:
   ```sql
   -- ใน Supabase Dashboard → SQL Editor
   DELETE FROM user_sessions;
   ```

---

## 3️⃣ Supabase Snapshot (Cloud Backup)

### Free tier (ที่ใช้ปัจจุบัน)
- ✅ Auto daily snapshot 7 วันย้อนหลัง
- ❌ ไม่มี Point-in-Time Recovery
- ❌ Restore ต้องผ่าน Supabase support

**ดู snapshot:**
1. ไป Supabase Dashboard → Project
2. Database → **Backups** (เมนูซ้าย)
3. ดูรายการ daily backups

### Pro tier ($25/เดือน) — ถ้าจำเป็น
- ✅ Daily snapshot 14 วัน
- ✅ Point-in-Time Recovery (PITR) 7 วันย้อนหลัง — restore ลงไปวินาทีใดก็ได้
- ✅ Self-service restore

### Restore จาก Supabase backup (Free tier)
ติดต่อ Supabase Support — มี SLA 24-72 ชั่วโมง

---

## 🛡️ Best Practices

### ทำ Backup เมื่อไหร่บ้าง
1. **ก่อนเพิ่ม feature ใหญ่** (ทุกครั้ง) — git tag + DB export
2. **ก่อน migration ที่ ALTER schema** (drop column / rename)
3. **ทุกสัปดาห์** (อย่างน้อย) — DB export + เก็บ external
4. **ก่อน upgrade Next.js / Supabase** — full backup

### Backup Rotation Policy (แนะนำ)
- เก็บ daily backup 7 วัน
- เก็บ weekly backup 4 สัปดาห์
- เก็บ monthly backup 6 เดือน
- เก็บ pre-feature backup ตลอดไป (จนกว่า feature นั้นจะเสถียร)

### Test Restore เป็นประจำ
```bash
# ทดสอบ dry-run ทุก backup ใหม่ — confirm ว่า restore ได้
node scripts/restore-db.mjs <latest-folder> --dry-run
```

---

## 📋 Quick Reference Commands

```bash
# Backup
node scripts/backup-db.mjs

# Backup → external folder
node scripts/backup-db.mjs --output /Volumes/Backup/lp-2026-04-30

# Restore (interactive — confirm needed)
node scripts/restore-db.mjs backups/<folder>

# Restore เฉพาะ tables
node scripts/restore-db.mjs backups/<folder> --tables=users,equipment

# Dry-run (ไม่เขียน DB)
node scripts/restore-db.mjs backups/<folder> --dry-run

# Git tag
git tag -a v1.0-name -m "description"
git push origin v1.0-name

# List tags
git tag -l

# Rollback to tag (safer — creates revert commits)
git revert v1.0-name..HEAD
```

---

## 🆘 Disaster Recovery Scenarios

### Scenario 1: เผลอ DELETE ข้อมูลผิด
1. **อย่าทำอะไรเพิ่ม** — block writes
2. หา backup ล่าสุดที่ยังมีข้อมูลที่ต้องการ
3. Restore เฉพาะ table ที่ผิด: `--tables=ชื่อ_table`
4. Logout user ทั้งหมด

### Scenario 2: Code Deploy พัง
1. **Rollback ก่อน** — Vercel Dashboard → Deployments → revert ไป deployment เก่า (instant)
2. หา root cause ใน git
3. Fix + redeploy

### Scenario 3: Migration เสีย — schema ผิด
1. Stop application
2. Restore DB จาก backup ก่อน migration
3. Fix migration SQL
4. Test บน staging ก่อน apply

### Scenario 4: Supabase Project หาย / Region down
1. ติดต่อ Supabase support
2. ระหว่างรอ — ถ้ามี DB export ล่าสุด:
   - สร้าง Supabase project ใหม่
   - รัน migrations
   - Restore DB
   - Update env vars ใน Vercel
   - Redeploy

---

## 📊 Backup Status (ปัจจุบัน)

```
Last backup: 2026-04-30_01-59-29
Tables: 13/13 ✅
Total rows: 303

ลำดับ tables:
  users                  15 rows
  company_settings        1 rows
  purchase_orders        28 rows
  equipment              11 rows
  equipment_categories    6 rows
  po_deliveries          12 rows
  po_activities          90 rows
  po_comments             5 rows
  withdrawals             8 rows
  budget_periods          2 rows
  notifications          48 rows
  user_sessions          30 rows
  login_attempts         47 rows
```

---

**อัปเดตล่าสุด**: 30 เมษายน 2569
