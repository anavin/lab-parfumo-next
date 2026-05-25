/**
 * Unit tests for linkSupplierToPoAction — permission gates, idempotency,
 * race-loss handling. Focused tests only — full action coverage is L1 pending.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeFakeSupabase } from "@/tests/_mocks/supabase";

// === Mocks (must register before importing po.ts) ===

const mockUser = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: () => mockUser(),
}));

let currentFake = makeFakeSupabase();
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: () => currentFake.client,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

// Late import — after mocks are wired
import { linkSupplierToPoAction } from "./po";

const adminUser = {
  id: "u-admin",
  full_name: "Admin User",
  role: "admin" as const,
  email: null,
};
const supervisorUser = { ...adminUser, id: "u-sup", role: "supervisor" as const };
const requesterUser = { ...adminUser, id: "u-staff", role: "requester" as const };

describe("linkSupplierToPoAction", () => {
  beforeEach(() => {
    mockUser.mockReset();
    currentFake = makeFakeSupabase();
  });

  it("rejects when no user is logged in", async () => {
    mockUser.mockResolvedValue(null);
    const res = await linkSupplierToPoAction("po-1", "sup-1");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/แอดมินหรือ Supervisor/);
  });

  it("rejects when user is a requester (not privileged)", async () => {
    mockUser.mockResolvedValue(requesterUser);
    const res = await linkSupplierToPoAction("po-1", "sup-1");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/แอดมินหรือ Supervisor/);
  });

  it("rejects when poId or supplierId is missing", async () => {
    mockUser.mockResolvedValue(adminUser);
    expect((await linkSupplierToPoAction("", "sup-1")).ok).toBe(false);
    expect((await linkSupplierToPoAction("po-1", "")).ok).toBe(false);
  });

  it("rejects when supplier doesn't exist", async () => {
    mockUser.mockResolvedValue(adminUser);
    currentFake = makeFakeSupabase({
      suppliers: { select: { data: null, error: null } },
    });
    const res = await linkSupplierToPoAction("po-1", "sup-missing");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/ไม่พบ Supplier/);
  });

  it("rejects when PO doesn't exist", async () => {
    mockUser.mockResolvedValue(adminUser);
    currentFake = makeFakeSupabase({
      suppliers: {
        select: {
          data: { id: "sup-1", name: "Acme Co.", is_active: true },
          error: null,
        },
      },
      purchase_orders: { select: { data: null, error: null } },
    });
    const res = await linkSupplierToPoAction("po-missing", "sup-1");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/ไม่พบใบ PO/);
  });

  it("is idempotent when PO already linked to the same supplier", async () => {
    mockUser.mockResolvedValue(adminUser);
    currentFake = makeFakeSupabase({
      suppliers: {
        select: {
          data: { id: "sup-1", name: "Acme Co.", is_active: true },
          error: null,
        },
      },
      purchase_orders: {
        select: {
          data: {
            id: "po-1",
            po_number: "PO-001",
            supplier_name: "Acme Co.",
            supplier_id: "sup-1",
          },
          error: null,
        },
      },
    });
    const res = await linkSupplierToPoAction("po-1", "sup-1");
    expect(res.ok).toBe(true);
    expect(res.poId).toBe("po-1");
    // ไม่ควรเรียก update เพราะ link อยู่แล้ว
    const updateCalls = currentFake.calls.filter(
      (c) => c.op === "update" && c.table === "purchase_orders",
    );
    expect(updateCalls.length).toBe(0);
  });

  it("rejects when PO is already linked to a DIFFERENT supplier", async () => {
    mockUser.mockResolvedValue(adminUser);
    currentFake = makeFakeSupabase({
      suppliers: {
        select: {
          data: { id: "sup-new", name: "Acme Co.", is_active: true },
          error: null,
        },
      },
      purchase_orders: {
        select: {
          data: {
            id: "po-1",
            po_number: "PO-001",
            supplier_name: "Old Co.",
            supplier_id: "sup-old",
          },
          error: null,
        },
      },
    });
    const res = await linkSupplierToPoAction("po-1", "sup-new");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/link Supplier|อยู่แล้ว/);
  });

  it("links successfully when supplier_id is null + supervisor role", async () => {
    mockUser.mockResolvedValue(supervisorUser);
    currentFake = makeFakeSupabase({
      suppliers: {
        select: {
          data: { id: "sup-1", name: "Acme Co.", is_active: true },
          error: null,
        },
      },
      purchase_orders: {
        select: {
          data: {
            id: "po-1",
            po_number: "PO-001",
            supplier_name: "acme co.", // เคสจะถูก sync เป็น "Acme Co."
            supplier_id: null,
          },
          error: null,
        },
        update: { data: null, error: null, count: 1 },
      },
      // logActivity ลง po_activities — ปล่อยให้ default ok
      po_activities: { insert: { data: null, error: null } },
    });
    const res = await linkSupplierToPoAction("po-1", "sup-1");
    expect(res.ok).toBe(true);
    expect(res.poId).toBe("po-1");
    // ควรเรียก update purchase_orders 1 ครั้ง
    const updateCalls = currentFake.calls.filter(
      (c) => c.op === "update" && c.table === "purchase_orders",
    );
    expect(updateCalls.length).toBe(1);
  });

  it("detects race loss when conditional UPDATE returns 0 rows", async () => {
    mockUser.mockResolvedValue(adminUser);
    currentFake = makeFakeSupabase({
      suppliers: {
        select: {
          data: { id: "sup-1", name: "Acme Co.", is_active: true },
          error: null,
        },
      },
      purchase_orders: {
        select: {
          data: {
            id: "po-1",
            po_number: "PO-001",
            supplier_name: "x",
            supplier_id: null,
          },
          error: null,
        },
        // race lost — admin คนอื่น linked ไปก่อน → UPDATE ... WHERE supplier_id IS NULL hit 0 rows
        update: { data: null, error: null, count: 0 },
      },
    });
    const res = await linkSupplierToPoAction("po-1", "sup-1");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/ผู้ใช้คนอื่น|refresh/);
  });
});
