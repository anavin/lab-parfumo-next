/**
 * Unit tests for previewWithdrawFifoAction — input validation + FIFO
 * consumption order across multiple lots
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeFakeSupabase } from "@/tests/_mocks/supabase";

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

import { previewWithdrawFifoAction } from "./withdraw";

const staffUser = {
  id: "u-staff",
  full_name: "Staff",
  role: "requester" as const,
  email: null,
};

describe("previewWithdrawFifoAction", () => {
  beforeEach(() => {
    mockUser.mockReset();
    currentFake = makeFakeSupabase();
  });

  it("rejects when not logged in", async () => {
    mockUser.mockResolvedValue(null);
    const res = await previewWithdrawFifoAction({ equipmentId: "eq-1", qty: 5 });
    expect(res.ok).toBe(false);
  });

  it("rejects invalid qty (zero, negative, NaN)", async () => {
    mockUser.mockResolvedValue(staffUser);
    expect((await previewWithdrawFifoAction({ equipmentId: "eq-1", qty: 0 })).ok).toBe(false);
    expect((await previewWithdrawFifoAction({ equipmentId: "eq-1", qty: -3 })).ok).toBe(false);
    expect((await previewWithdrawFifoAction({ equipmentId: "eq-1", qty: NaN })).ok).toBe(false);
  });

  it("rejects when equipment doesn't exist", async () => {
    mockUser.mockResolvedValue(staffUser);
    currentFake = makeFakeSupabase({
      equipment: { select: { data: null, error: null } },
      lots: { select: { data: [], error: null } },
    });
    const res = await previewWithdrawFifoAction({ equipmentId: "eq-missing", qty: 5 });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/ไม่พบอุปกรณ์/);
  });

  it("returns empty lots when equipment has no active lots (stock-only deduction)", async () => {
    mockUser.mockResolvedValue(staffUser);
    currentFake = makeFakeSupabase({
      equipment: { select: { data: { stock: 50 }, error: null } },
      lots: { select: { data: [], error: null } },
    });
    const res = await previewWithdrawFifoAction({ equipmentId: "eq-1", qty: 10 });
    expect(res.ok).toBe(true);
    expect(res.lots).toEqual([]);
    expect(res.unallocated).toBe(10); // ทั้งหมดจะ deduct จาก stock
    expect(res.currentStock).toBe(50);
  });

  it("consumes a single lot when it has enough", async () => {
    mockUser.mockResolvedValue(staffUser);
    currentFake = makeFakeSupabase({
      equipment: { select: { data: { stock: 100 }, error: null } },
      lots: {
        select: {
          data: [
            {
              id: "lot-1", lot_no: "LOT-A", qty_remaining: 50,
              expiry_date: "2026-12-31", received_date: "2026-01-01",
              supplier_name: "Acme",
            },
          ],
          error: null,
        },
      },
    });
    const res = await previewWithdrawFifoAction({ equipmentId: "eq-1", qty: 30 });
    expect(res.ok).toBe(true);
    expect(res.lots).toHaveLength(1);
    expect(res.lots?.[0]).toMatchObject({
      lotId: "lot-1",
      lotNo: "LOT-A",
      qtyToConsume: 30,
      qtyAvailable: 50,
    });
    expect(res.unallocated).toBe(0);
  });

  it("consumes lots in FIFO order across multiple lots", async () => {
    mockUser.mockResolvedValue(staffUser);
    // lots come back already ordered by received_date ASC (Supabase .order())
    currentFake = makeFakeSupabase({
      equipment: { select: { data: { stock: 200 }, error: null } },
      lots: {
        select: {
          data: [
            { id: "lot-a", lot_no: "A", qty_remaining: 60, expiry_date: null, received_date: "2026-01-01", supplier_name: null },
            { id: "lot-b", lot_no: "B", qty_remaining: 50, expiry_date: null, received_date: "2026-02-01", supplier_name: null },
            { id: "lot-c", lot_no: "C", qty_remaining: 100, expiry_date: null, received_date: "2026-03-01", supplier_name: null },
          ],
          error: null,
        },
      },
    });
    const res = await previewWithdrawFifoAction({ equipmentId: "eq-1", qty: 130 });
    expect(res.ok).toBe(true);
    expect(res.lots).toHaveLength(3);
    expect(res.lots?.[0]).toMatchObject({ lotNo: "A", qtyToConsume: 60 });
    expect(res.lots?.[1]).toMatchObject({ lotNo: "B", qtyToConsume: 50 });
    expect(res.lots?.[2]).toMatchObject({ lotNo: "C", qtyToConsume: 20 });
    expect(res.unallocated).toBe(0);
  });

  it("reports unallocated when lots don't cover requested qty", async () => {
    mockUser.mockResolvedValue(staffUser);
    currentFake = makeFakeSupabase({
      equipment: { select: { data: { stock: 200 }, error: null } },
      lots: {
        select: {
          data: [
            { id: "lot-a", lot_no: "A", qty_remaining: 30, expiry_date: null, received_date: "2026-01-01", supplier_name: null },
          ],
          error: null,
        },
      },
    });
    const res = await previewWithdrawFifoAction({ equipmentId: "eq-1", qty: 100 });
    expect(res.ok).toBe(true);
    expect(res.lots).toHaveLength(1);
    expect(res.lots?.[0]).toMatchObject({ lotNo: "A", qtyToConsume: 30 });
    expect(res.unallocated).toBe(70); // 100 - 30
  });
});
