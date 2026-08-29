/**
 * Skeleton สำหรับ /trash — โหลดข้อมูลจาก getTrashedPos/Suppliers
 * ป้องกันหน้าจอเปล่าระหว่างเปลี่ยนหน้า
 */
export default function TrashLoading() {
  return (
    <div className="space-y-5">
      <div>
        <div className="h-7 w-32 bg-slate-200 rounded animate-pulse mb-2" />
        <div className="h-4 w-64 bg-slate-100 rounded animate-pulse" />
      </div>
      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <div className="h-10 w-24 bg-slate-100 rounded-t animate-pulse" />
        <div className="h-10 w-24 bg-slate-50 rounded-t animate-pulse" />
      </div>
      {/* Rows */}
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="border border-border rounded-lg p-4 flex items-center justify-between gap-3"
          >
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-64 bg-slate-100 rounded animate-pulse" />
            </div>
            <div className="flex gap-1.5">
              <div className="h-8 w-16 bg-slate-100 rounded animate-pulse" />
              <div className="h-8 w-20 bg-slate-100 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
