import type { Metadata } from "next";
import { requirePrivileged } from "@/lib/auth/require-user";
import { getTrashedPos, getTrashedSuppliers } from "@/lib/db/trash";
import { TrashClient } from "./_components/trash-client";

export const metadata: Metadata = {
  title: "ถังขยะ — Lab Parfumo PO",
};

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  await requirePrivileged();
  const [pos, suppliers] = await Promise.all([
    getTrashedPos(),
    getTrashedSuppliers(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 inline-flex items-center gap-2">
          🗑️ ถังขยะ
        </h1>
        <p className="text-sm text-slate-500">
          รายการที่ถูกลบ — กู้คืนหรือลบถาวรจากที่นี่
        </p>
      </div>

      <TrashClient pos={pos} suppliers={suppliers} />
    </div>
  );
}
