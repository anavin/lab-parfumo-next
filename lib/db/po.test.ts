/**
 * Unit tests for PO domain logic (computeStats, pickActionItems, topSuppliers)
 */
import { describe, it, expect } from "vitest";
import { computeStats, pickActionItems, topSuppliers, buildMonthlyTrend } from "./po";
import type { PurchaseOrder } from "@/lib/types/db";

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
const weekAgo = new Date(Date.now() - 8 * 86400_000).toISOString();

function makePo(overrides: Partial<PurchaseOrder>): PurchaseOrder {
  return {
    id: "po-1",
    po_number: "PO-2026-0001",
    status: "รอจัดซื้อดำเนินการ",
    items: [],
    purpose: null,
    notes: null,
    supplier_name: null,
    supplier_contact: null,
    subtotal: null,
    discount: null,
    shipping_fee: null,
    vat: null,
    total: null,
    ordered_date: null,
    expected_date: null,
    received_date: null,
    tracking_number: null,
    procurement_notes: null,
    attachment_urls: null,
    created_by: "user-1",
    created_by_name: "Test User",
    created_at: new Date().toISOString(),
    updated_at: null,
    ...overrides,
  };
}

describe("computeStats", () => {
  it("returns zeros for empty list", () => {
    const s = computeStats([]);
    expect(s.total).toBe(0);
    expect(s.pending).toBe(0);
    expect(s.thisMonthSpend).toBe(0);
    expect(s.overdueCount).toBe(0);
  });

  it("counts by status correctly", () => {
    const pos = [
      makePo({ id: "1", status: "รอจัดซื้อดำเนินการ" }),
      makePo({ id: "2", status: "รอจัดซื้อดำเนินการ" }),
      makePo({ id: "3", status: "เสร็จสมบูรณ์" }),
      makePo({ id: "4", status: "ยกเลิก" }),
    ];
    const s = computeStats(pos);
    expect(s.total).toBe(4);
    expect(s.byStatus["รอจัดซื้อดำเนินการ"]).toBe(2);
    expect(s.byStatus["เสร็จสมบูรณ์"]).toBe(1);
    expect(s.byStatus["ยกเลิก"]).toBe(1);
  });

  it("identifies overdue POs (expected_date < today, status pending receipt)", () => {
    const pos = [
      makePo({ id: "1", status: "สั่งซื้อแล้ว", expected_date: yesterday }), // overdue
      makePo({ id: "2", status: "กำลังขนส่ง", expected_date: yesterday }),    // overdue
      makePo({ id: "3", status: "กำลังขนส่ง", expected_date: tomorrow }),     // upcoming
      makePo({ id: "4", status: "เสร็จสมบูรณ์", expected_date: yesterday }),  // not pending
    ];
    const s = computeStats(pos);
    expect(s.overdueCount).toBe(2);
    expect(s.upcomingCount).toBe(1);
  });

  it("computes pending count (active statuses)", () => {
    const pos = [
      makePo({ id: "1", status: "รอจัดซื้อดำเนินการ" }),
      makePo({ id: "2", status: "สั่งซื้อแล้ว" }),
      makePo({ id: "3", status: "กำลังขนส่ง" }),
      makePo({ id: "4", status: "รับของแล้ว" }), // not pending
    ];
    const s = computeStats(pos);
    expect(s.pending).toBe(3);
  });

  it("computes thisMonth spend (counts by ordered_date)", () => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 5)
      .toISOString().slice(0, 10);
    const pos = [
      makePo({
        id: "1", status: "เสร็จสมบูรณ์",
        ordered_date: thisMonth, total: 1000,
      }),
      makePo({
        id: "2", status: "รับของแล้ว",
        ordered_date: thisMonth, total: 500,
      }),
      makePo({
        id: "3", status: "ยกเลิก",  // ยกเลิก ไม่นับ
        ordered_date: thisMonth, total: 9999,
      }),
    ];
    const s = computeStats(pos);
    expect(s.thisMonthSpend).toBe(1500);
  });

  it("counts newThisWeek correctly", () => {
    const pos = [
      makePo({ id: "1", created_at: new Date().toISOString() }),
      makePo({ id: "2", created_at: weekAgo }),
    ];
    const s = computeStats(pos);
    expect(s.newThisWeek).toBe(1);
  });
});

describe("pickActionItems — admin", () => {
  it("includes รอจัดซื้อ + มีปัญหา + เลยกำหนด", () => {
    const pos = [
      makePo({ id: "1", status: "รอจัดซื้อดำเนินการ" }),
      makePo({ id: "2", status: "มีปัญหา" }),
      makePo({ id: "3", status: "สั่งซื้อแล้ว", expected_date: yesterday }), // overdue
      makePo({ id: "4", status: "เสร็จสมบูรณ์" }), // not picked
    ];
    const result = pickActionItems(pos, true);
    const ids = result.map((p) => p.id);
    expect(ids).toContain("1");
    expect(ids).toContain("2");
    expect(ids).toContain("3");
    expect(ids).not.toContain("4");
  });

  it("dedupes overlapping (e.g., มีปัญหา + overdue)", () => {
    const pos = [
      makePo({ id: "1", status: "มีปัญหา", expected_date: yesterday }),
    ];
    const result = pickActionItems(pos, true);
    expect(result).toHaveLength(1);
  });
});

describe("pickActionItems — requester", () => {
  it("includes รับของแล้ว + มีปัญหา + ใกล้ครบกำหนด", () => {
    const pos = [
      makePo({ id: "1", status: "รับของแล้ว" }),
      makePo({ id: "2", status: "มีปัญหา" }),
      makePo({ id: "3", status: "กำลังขนส่ง", expected_date: tomorrow }), // upcoming
      makePo({ id: "4", status: "รอจัดซื้อดำเนินการ" }), // not picked for requester
    ];
    const result = pickActionItems(pos, false);
    const ids = result.map((p) => p.id);
    expect(ids).toContain("1");
    expect(ids).toContain("2");
    expect(ids).toContain("3");
    expect(ids).not.toContain("4");
  });
});

describe("topSuppliers", () => {
  it("sorts by spend descending", () => {
    const pos = [
      makePo({ id: "1", status: "เสร็จสมบูรณ์", supplier_name: "A", total: 100 }),
      makePo({ id: "2", status: "เสร็จสมบูรณ์", supplier_name: "B", total: 500 }),
      makePo({ id: "3", status: "เสร็จสมบูรณ์", supplier_name: "B", total: 300 }),
      makePo({ id: "4", status: "เสร็จสมบูรณ์", supplier_name: "A", total: 200 }),
    ];
    const result = topSuppliers(pos, 5);
    expect(result[0].name).toBe("B");
    expect(result[0].spend).toBe(800);
    expect(result[0].poCount).toBe(2);
    expect(result[1].name).toBe("A");
    expect(result[1].spend).toBe(300);
  });

  it("ignores POs without supplier or total", () => {
    const pos = [
      makePo({ id: "1", status: "เสร็จสมบูรณ์", supplier_name: null, total: 100 }),
      makePo({ id: "2", status: "เสร็จสมบูรณ์", supplier_name: "A", total: null }),
      makePo({ id: "3", status: "ยกเลิก", supplier_name: "A", total: 500 }),
    ];
    expect(topSuppliers(pos)).toHaveLength(0);
  });

  it("limits to top N", () => {
    const pos = Array.from({ length: 10 }, (_, i) =>
      makePo({ id: `${i}`, status: "เสร็จสมบูรณ์", supplier_name: `S${i}`, total: 100 + i }),
    );
    expect(topSuppliers(pos, 3)).toHaveLength(3);
  });
});

describe("buildMonthlyTrend", () => {
  it("returns N month buckets", () => {
    const trend = buildMonthlyTrend([], 6);
    expect(trend).toHaveLength(6);
    // ทุก bucket ต้องมี month + monthLabel + spend + poCount
    trend.forEach((b) => {
      expect(b).toHaveProperty("month");
      expect(b).toHaveProperty("monthLabel");
      expect(b.spend).toBe(0);
      expect(b.poCount).toBe(0);
    });
  });
});
