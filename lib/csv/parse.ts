/**
 * Minimal CSV parser — RFC 4180-ish
 * รองรับ:
 *  - Quoted fields: "field"
 *  - Embedded quotes: "" → "
 *  - Embedded newlines + commas in quoted fields
 *  - BOM stripping
 *  - CRLF / LF
 *
 * เลือกเขียนเอง (ไม่ใช้ papaparse) เพราะ:
 *  - ไม่อยากเพิ่ม dep หนัก ๆ ใน bundle
 *  - กรณี edge ของเรา (CSV ภายใน + admin upload) จัดการง่าย
 */

/** parse CSV text → 2D array of strings */
export function parseCsv(text: string): string[][] {
  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      // ignore — handle on \n
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      // Skip wholly empty rows (no field, no trailing comma)
      if (!(row.length === 1 && row[0] === "")) rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }

  // Last field
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
  }

  return rows;
}

/** parse + map header row into dict objects */
export function parseCsvWithHeader(text: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const all = parseCsv(text);
  if (all.length === 0) return { headers: [], rows: [] };
  const headers = all[0].map((h) => h.trim());
  const rows = all.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
  return { headers, rows };
}
