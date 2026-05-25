/**
 * Minimal Supabase client mock for action/DB tests
 *
 * Pattern in real code:
 *   sb.from("table").select("...").eq("col", v).maybeSingle()  → { data, error }
 *   sb.from("table").update(payload).eq(...).is(...)            → { data, error, count }
 *   sb.from("table").insert(payload).select().maybeSingle()     → { data, error }
 *
 * Test code calls makeFakeSupabase({ tableName: { result: ... } }) — every
 * method on the builder returns `this`, and terminal methods return the
 * configured result. `calls` records call sequences so tests can assert
 * what was invoked.
 *
 * Wiring (must be at top-level of the test file, NOT inside a function —
 * vi.mock is hoisted):
 *
 *   let fake = makeFakeSupabase();
 *   vi.mock("@/lib/supabase/server", () => ({
 *     getSupabaseAdmin: () => fake.client,
 *   }));
 */

export interface TableResult {
  /** Result returned by terminal methods (maybeSingle, then, await) */
  data?: unknown;
  error?: { message: string } | null;
  count?: number | null;
}

export interface TableConfig {
  /** Default result for SELECT terminals */
  select?: TableResult | (() => TableResult);
  /** Default result for UPDATE terminals (resolves the awaited builder) */
  update?: TableResult | (() => TableResult);
  /** Default result for INSERT terminals */
  insert?: TableResult | (() => TableResult);
  /** Default result for DELETE terminals */
  delete?: TableResult | (() => TableResult);
}

export interface FakeSupabaseCall {
  table: string;
  op: "select" | "update" | "insert" | "delete" | "upsert";
  args: unknown[];
}

export interface FakeSupabase {
  client: { from: (t: string) => unknown };
  calls: FakeSupabaseCall[];
}

function resolve<T>(r: T | (() => T)): T {
  return typeof r === "function" ? (r as () => T)() : r;
}

export function makeFakeSupabase(
  config: Record<string, TableConfig> = {},
): FakeSupabase {
  const calls: FakeSupabaseCall[] = [];

  function makeBuilder(table: string, op: FakeSupabaseCall["op"], opArgs: unknown[]) {
    let currentResult: TableResult = {};
    const cfg = config[table];
    if (op === "select" && cfg?.select) currentResult = resolve(cfg.select);
    if (op === "update" && cfg?.update) currentResult = resolve(cfg.update);
    if (op === "insert" && cfg?.insert) currentResult = resolve(cfg.insert);
    if (op === "delete" && cfg?.delete) currentResult = resolve(cfg.delete);

    const builder: Record<string, unknown> & PromiseLike<TableResult> = {} as never;
    // Chainable methods — return builder
    const chainable = [
      "select", "eq", "neq", "in", "is", "not", "or",
      "ilike", "like", "match", "gt", "gte", "lt", "lte",
      "order", "limit", "range", "filter", "contains",
    ];
    for (const m of chainable) {
      builder[m] = (..._args: unknown[]) => builder;
    }
    // Terminal methods — return result
    builder.maybeSingle = async () => currentResult;
    builder.single = async () => currentResult;
    // PromiseLike — so `await sb.from(...).update(...).eq(...)` works
    builder.then = ((onfulfilled?: (v: TableResult) => unknown, onrejected?: (e: unknown) => unknown) =>
      Promise.resolve(currentResult).then(onfulfilled, onrejected)) as PromiseLike<TableResult>["then"];

    calls.push({ table, op, args: opArgs });
    return builder;
  }

  const client = {
    from(table: string) {
      return {
        select: (...args: unknown[]) => makeBuilder(table, "select", args),
        update: (...args: unknown[]) => makeBuilder(table, "update", args),
        insert: (...args: unknown[]) => makeBuilder(table, "insert", args),
        delete: (...args: unknown[]) => makeBuilder(table, "delete", args),
        upsert: (...args: unknown[]) => makeBuilder(table, "upsert", args),
      };
    },
  };

  return { client, calls };
}
