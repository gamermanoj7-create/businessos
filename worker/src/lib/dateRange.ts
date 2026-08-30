import type { Context } from "hono";

/**
 * Resolves ?range=today|7days|month|custom&start=YYYY-MM-DD&end=YYYY-MM-DD
 * into concrete [start, end] dates (inclusive), in the server's UTC date.
 * Frontend is responsible for showing dates in the business's local time;
 * for a single-country shop app, UTC-day boundaries are an acceptable and
 * simple default (documented in README).
 */
export function resolveRange(c: Context): { start: string; end: string } {
  const range = c.req.query("range") || "today";
  const today = new Date();
  const toISODate = (d: Date) => d.toISOString().slice(0, 10);

  if (range === "custom") {
    const start = c.req.query("start");
    const end = c.req.query("end");
    if (start && end) return { start, end };
  }

  if (range === "7days") {
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - 6);
    return { start: toISODate(start), end: toISODate(today) };
  }

  if (range === "month") {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    return { start: toISODate(start), end: toISODate(today) };
  }

  // default: today
  return { start: toISODate(today), end: toISODate(today) };
}
