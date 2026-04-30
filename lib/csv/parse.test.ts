/**
 * Unit tests for CSV parser
 */
import { describe, it, expect } from "vitest";
import { parseCsv, parseCsvWithHeader } from "./parse";

describe("parseCsv", () => {
  it("parses simple CSV", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with commas", () => {
    expect(parseCsv('a,"b,c",d\n1,2,3')).toEqual([
      ["a", "b,c", "d"],
      ["1", "2", "3"],
    ]);
  });

  it("handles embedded quotes via doubling", () => {
    expect(parseCsv('a,"b ""quoted"" c",d')).toEqual([
      ["a", 'b "quoted" c', "d"],
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("strips BOM", () => {
    expect(parseCsv("﻿a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles embedded newlines in quoted field", () => {
    expect(parseCsv('a,"line1\nline2",b\n1,2,3')).toEqual([
      ["a", "line1\nline2", "b"],
      ["1", "2", "3"],
    ]);
  });

  it("preserves empty fields", () => {
    expect(parseCsv("a,,c\n,,")).toEqual([
      ["a", "", "c"],
      ["", "", ""],
    ]);
  });

  it("ignores fully empty trailing rows", () => {
    expect(parseCsv("a,b\n1,2\n\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles Thai text", () => {
    expect(parseCsv("ชื่อ,หน่วย\nขวด 50ml,ชิ้น")).toEqual([
      ["ชื่อ", "หน่วย"],
      ["ขวด 50ml", "ชิ้น"],
    ]);
  });
});

describe("parseCsvWithHeader", () => {
  it("maps header → dict", () => {
    const { headers, rows } = parseCsvWithHeader("name,qty\nA,5\nB,10");
    expect(headers).toEqual(["name", "qty"]);
    expect(rows).toEqual([
      { name: "A", qty: "5" },
      { name: "B", qty: "10" },
    ]);
  });

  it("trims header whitespace", () => {
    const { headers } = parseCsvWithHeader(" name , qty \nA,1");
    expect(headers).toEqual(["name", "qty"]);
  });

  it("returns empty when no rows", () => {
    expect(parseCsvWithHeader("")).toEqual({ headers: [], rows: [] });
  });

  it("fills missing columns as empty string", () => {
    const { rows } = parseCsvWithHeader("a,b,c\n1,2");
    expect(rows[0]).toEqual({ a: "1", b: "2", c: "" });
  });
});
