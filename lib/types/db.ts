/**
 * Database types ที่ map ไปยัง Supabase schema
 *
 * แทนที่จะ generate ผ่าน supabase-cli (ต้องใช้ accessToken)
 * ผมเขียนมือเพื่อความเรียบง่าย — ตรงกับ schema ที่มีอยู่ใน
 * supabase_setup.sql + migrations
 */

// ==================================================================
// Enums / Constants — ตรงกับ Status class ใน helpers.py
// ==================================================================
export const PO_STATUSES = [
  "รอจัดซื้อดำเนินการ",
  "สั่งซื้อแล้ว",
  "กำลังขนส่ง",
  "รับของแล้ว",
  "มีปัญหา",
  "เสร็จสมบูรณ์",
  "ยกเลิก",
] as const;
export type PoStatus = (typeof PO_STATUSES)[number];

export const ROLES = ["admin", "supervisor", "requester"] as const;
export type Role = (typeof ROLES)[number];

/** Role ที่มีสิทธิ์เหมือน admin (ยกเว้น settings + manage admin users) */
export const PRIVILEGED_ROLES = ["admin", "supervisor"] as const;
export type PrivilegedRole = (typeof PRIVILEGED_ROLES)[number];

// ==================================================================
// Sort + filter constants (shared by client + server)
// ==================================================================
export type PoSortKey =
  | "newest" | "oldest"
  | "total_desc" | "total_asc"
  | "supplier_asc" | "expected_asc";

export const SORT_LABELS: Record<PoSortKey, string> = {
  newest: "ใหม่สุด",
  oldest: "เก่าสุด",
  total_desc: "ยอดเงินสูง→ต่ำ",
  total_asc: "ยอดเงินต่ำ→สูง",
  supplier_asc: "Supplier A→Z",
  expected_asc: "ใกล้ครบกำหนด",
};

/** Supplier ที่เคยใช้ — สำหรับ autocomplete ในฟอร์มจัดซื้อ */
export interface SupplierEntry {
  name: string;
  lastContact: string;
  lastUsed: string;     // ISO date
  poCount: number;
  lastPo: string;
}

/** Categories ของ Supplier (default — admin จะแก้ใน UI ได้) */
export const SUPPLIER_CATEGORIES = [
  "บรรจุภัณฑ์",
  "สารเคมี",
  "อุปกรณ์",
  "บริการ",
  "อื่นๆ",
] as const;

/** Supplier — ผู้ผลิต / ผู้ขาย */
export interface Supplier {
  id: string;
  name: string;
  code: string | null;             // รหัสภายใน เช่น "S001"
  tax_id: string | null;           // เลขผู้เสียภาษี
  category: string;                // หมวดหมู่ (free text — ดู SUPPLIER_CATEGORIES สำหรับ default)

  // Contact
  contact_person: string;
  phone: string;
  email: string;
  address: string;

  // Payment
  bank_name: string;
  bank_account: string;
  payment_terms: string;           // เครดิตเทอม

  // Internal
  notes: string;
  is_active: boolean;

  // Audit
  created_at: string;
  updated_at: string;
  created_by_name: string;
  updated_by_name: string;
}

/** Supplier + stats — ใช้ใน list page + detail */
export interface SupplierWithStats extends Supplier {
  poCount: number;          // จำนวน PO ทั้งหมด
  totalSpend: number;       // ยอดรวมของ PO ที่ counted-for-spend
  poCountThisYear: number;
  totalSpendThisYear: number;
  pendingPoCount: number;   // PO ที่ยังไม่ปิด
  lastPoDate: string | null;
  lastPoNumber: string | null;
}

// ==================================================================
// Row types
// ==================================================================
export interface User {
  id: string;
  username: string;
  password_hash: string;
  full_name: string;
  role: Role;
  email: string | null;
  is_active: boolean;
  must_change_password: boolean;
  failed_login_count: number | null;
  last_login_at: string | null;
  password_changed_at: string | null;
  created_at: string;
}

export interface UserSession {
  token: string;
  user_id: string;
  created_at: string;
  last_activity_at: string;
}

export interface Equipment {
  id: string;
  sku: string | null;
  name: string;
  category: string | null;
  unit: string;
  description: string | null;
  last_cost: number;
  stock: number;
  reorder_level: number;
  image_url: string | null;
  image_urls: string[] | null;
  is_active: boolean;
  approval_status: "approved" | "pending" | "rejected" | null;
  approved_at: string | null;
  approved_by_name: string | null;
  rejected_at: string | null;
  rejected_reason: string | null;
  rejected_by_name: string | null;
  suggested_at: string | null;
  suggested_by: string | null;
  suggested_by_name: string | null;
  suggested_from_po: string | null;
  suggested_notes: string | null;
  created_at: string;
}

export interface PoItem {
  equipment_id: string | null;
  name: string;
  qty: number;
  unit: string;
  unit_price?: number;
  subtotal?: number;
  notes?: string;
  image_urls?: string[];
}

export interface PoAttachment {
  url: string;
  name: string;
  size: number;
  type: string;
  category?: "order" | "shipping" | "general";
  uploaded_by?: string;
  uploaded_at?: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  status: PoStatus;
  items: PoItem[];
  purpose: string | null;
  notes: string | null;
  supplier_name: string | null;
  supplier_contact: string | null;
  /** FK → suppliers.id — null ถ้า PO เก่าไม่ได้ link / supplier ถูกลบ */
  supplier_id: string | null;
  subtotal: number | null;
  discount: number | null;
  shipping_fee: number | null;
  vat: number | null;
  total: number | null;
  ordered_date: string | null;
  expected_date: string | null;
  received_date: string | null;
  tracking_number: string | null;
  procurement_notes: string | null;
  attachment_urls: PoAttachment[] | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface Withdrawal {
  id: string;
  equipment_id: string;
  equipment_name: string;
  qty: number;
  unit: string;
  purpose: string;
  withdrawn_by: string;
  withdrawn_by_name: string;
  withdrawn_at: string;
  notes: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  po_id: string | null;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
}

// ==================================================================
// Database type (Supabase typed-client compat)
// ==================================================================
export interface Database {
  public: {
    Tables: {
      users: { Row: User; Insert: Partial<User>; Update: Partial<User> };
      user_sessions: {
        Row: UserSession;
        Insert: Partial<UserSession> & { token: string; user_id: string };
        Update: Partial<UserSession>;
      };
      equipment: {
        Row: Equipment;
        Insert: Partial<Equipment> & { name: string };
        Update: Partial<Equipment>;
      };
      purchase_orders: {
        Row: PurchaseOrder;
        Insert: Partial<PurchaseOrder> & { po_number: string; items: PoItem[]; status: PoStatus };
        Update: Partial<PurchaseOrder>;
      };
      withdrawals: {
        Row: Withdrawal;
        Insert: Partial<Withdrawal>;
        Update: Partial<Withdrawal>;
      };
      notifications: {
        Row: Notification;
        Insert: Partial<Notification>;
        Update: Partial<Notification>;
      };
      login_attempts: {
        Row: { id: string; username: string; success: boolean; created_at: string };
        Insert: { username: string; success: boolean };
        Update: never;
      };
      equipment_categories: {
        Row: { id: string; name: string; display_order: number | null; created_at: string };
        Insert: { name: string; display_order?: number };
        Update: { name?: string; display_order?: number };
      };
    };
    Views: Record<string, never>;
    Functions: {
      next_po_number: { Args: { year_int: number }; Returns: string };
      withdraw_stock: {
        Args: { p_equipment_id: string; p_qty: number };
        Returns: { success: boolean; error?: string; current_stock?: number; name?: string; unit?: string };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// ==================================================================
// Budget + Search shared types (used by client components)
// ==================================================================
export interface Budget {
  id: string;
  period_type: "monthly" | "quarterly" | "yearly";
  period_year: number;
  period_month: number | null;
  category: string | null;
  amount: number;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface BudgetStatus extends Budget {
  actual: number;
  remaining: number;
  percent: number;
  status: "ok" | "warning" | "critical" | "over";
}

export interface SearchResult {
  pos: PurchaseOrder[];
  equipment: Equipment[];
  suppliers: Array<{ name: string; poCount: number }>;
}

// ==================================================================
// PO Delivery (ประวัติการรับของ) — shared by client lightbox UI
// ==================================================================
export interface PoDeliveryItem {
  equipment_id: string | null;
  name: string;
  qty_ordered: number;
  qty_received: number;
  qty_damaged: number;
  notes?: string;
}

export interface PoDelivery {
  id: string;
  po_id: string;
  delivery_no: number;
  received_date: string;
  received_by_name: string | null;
  items_received: PoDeliveryItem[];
  overall_condition: string;
  issue_description: string | null;
  notes: string | null;
  image_urls: string[] | null;
}
