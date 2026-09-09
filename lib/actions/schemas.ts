/**
 * Zod schemas for Server Action inputs
 *
 * Centralized validation — every Server Action that accepts user input
 * should validate via .safeParse() before touching the DB.
 */
import { z } from "zod";

// ==================================================================
// Users
// ==================================================================
export const createUserSchema = z.object({
  username: z.string().trim()
    .min(3, "Username อย่างน้อย 3 ตัว")
    .max(40, "Username ยาวเกินไป (สูงสุด 40 ตัว)")
    .regex(/^[a-zA-Z0-9._-]+$/, "Username ใช้ได้เฉพาะ a-z, 0-9, . _ -"),
  password: z.string().min(8, "รหัสผ่านอย่างน้อย 8 ตัว").max(128),
  fullName: z.string().trim().min(1, "กรุณากรอกชื่อ").max(100),
  role: z.enum(["admin", "supervisor", "requester"]),
  email: z.string().trim().email("อีเมลไม่ถูกต้อง").max(120).optional()
    .or(z.literal("")),
  sendEmail: z.boolean().optional(),
});

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().max(120)
    .refine((v) => !v || z.string().email().safeParse(v).success, "อีเมลไม่ถูกต้อง")
    .optional(),
  role: z.enum(["admin", "supervisor", "requester"]).optional(),
  isActive: z.boolean().optional(),
  newPassword: z.string().min(8).max(128).optional(),
});

// ==================================================================
// PO
// ==================================================================
export const poItemSchema = z.object({
  equipment_id: z.string().uuid().nullable(),
  name: z.string().trim().min(1, "กรุณากรอกชื่อรายการ").max(200),
  qty: z.number().int().min(1, "จำนวนต้องมากกว่า 0").max(99999),
  unit: z.string().trim().max(20).optional(),
  unit_price: z.number().min(0).max(99999999).optional(),
  subtotal: z.number().min(0).max(99999999).optional(),
  notes: z.string().max(500).optional(),
  image_urls: z.array(z.string().url()).max(10).optional(),
});

export const createPoSchema = z.object({
  items: z.array(poItemSchema).min(1, "กรุณาเพิ่มรายการอย่างน้อย 1").max(50),
  notes: z.string().max(2000).optional(),
});

export const cancelPoSchema = z.object({
  poId: z.string().uuid(),
  reason: z.string().trim().min(1, "กรุณาระบุเหตุผล").max(500),
});

// ==================================================================
// Equipment
// ==================================================================
export const createEquipmentSchema = z.object({
  sku: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().max(80).optional(),
  unit: z.string().trim().max(20).optional(),
  description: z.string().max(1000).optional(),
  last_cost: z.number().min(0).max(99999999).optional(),
  stock: z.number().int().min(0).max(99999999).optional(),
  reorder_level: z.number().int().min(0).max(99999999).optional(),
  image_url: z.string().url().nullable().optional(),
  image_urls: z.array(z.string().url()).max(10).optional(),
});

// ==================================================================
// Withdraw
// ==================================================================
export const withdrawSchema = z.object({
  equipment_id: z.string().uuid(),
  qty: z.number().int().min(1, "จำนวนต้องมากกว่า 0").max(99999),
  notes: z.string().max(500).optional(),
});

// ==================================================================
// Suppliers
// ==================================================================
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อ Supplier").max(120),
  code: optionalText(40),
  tax_id: optionalText(20),
  category: optionalText(60),
  contact_person: optionalText(120),
  phone: optionalText(40),
  email: z.string().trim().max(120)
    .refine((v) => !v || z.string().email().safeParse(v).success, "อีเมลไม่ถูกต้อง")
    .optional()
    .or(z.literal("")),
  address: optionalText(500),
  bank_name: optionalText(60),
  bank_account: optionalText(40),
  payment_terms: optionalText(120),
  notes: optionalText(1000),
  is_active: z.boolean().optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

// ==================================================================
// Credit-card payments
// ==================================================================

/** Amount ที่กรอก: ต้อง > 0, ≤ 99M, 2dp precision */
const positiveMoney = z.number()
  .finite()
  .positive("ยอดต้อง > 0")
  .max(99_000_000, "ยอดใหญ่เกินไป")
  .transform((n) => Math.round(n * 100) / 100);

/** วันที่: strict YYYY-MM-DD */
const isoDate = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ต้องเป็น YYYY-MM-DD");

export const recordPaymentSchema = z.object({
  allocations: z.array(z.object({
    poId: z.string().uuid("po_id ไม่ถูกต้อง"),
    amount: positiveMoney,
  })).min(1, "เลือก PO อย่างน้อย 1 ใบ").max(20, "จ่ายพร้อมกันสูงสุด 20 PO"),
  paidDate: isoDate,
  cardDisplay: z.string().trim().min(1, "กรุณาระบุบัตร").max(100),
  slipUrl: z.string().url().max(2000).optional(),
  approvalCode: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const markReimbursedSchema = z.object({
  paymentIds: z.array(z.string().uuid()).min(1, "เลือก payment อย่างน้อย 1")
    .max(500, "bulk mark สูงสุด 500 รายการ"),
  reimbursedDate: isoDate,
  reimbursementRef: z.string().trim().max(200).optional(),
});

export const unmarkReimbursedSchema = z.object({
  paymentIds: z.array(z.string().uuid()).min(1).max(500),
});

export const voidPaymentSchema = z.object({
  paymentId: z.string().uuid(),
  reason: z.string().trim().min(1, "ระบุเหตุผลในการลบ").max(500),
});

// ==================================================================
// Helper: format zod errors as Thai-friendly string
// ==================================================================
export function formatZodError(err: z.ZodError): string {
  return err.errors.map((e) => e.message).join(" • ");
}
