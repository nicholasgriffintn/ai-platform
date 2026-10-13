import {
  formatServerTimings,
  runWithServerTimings,
  type ServerTimings,
} from "@ngriffin_uk/polychat-utility-server/server-timing";
import type { Context, Next } from "hono";

export const serverTimingMiddleware = async (c: Context, next: Next) => {
  const timings: ServerTimings = new Map();
  const started = performance.now();

  await runWithServerTimings(timings, () => next());

  try {
    c.res.headers.set("Server-Timing", formatServerTimings(timings, performance.now() - started));
  } catch {
    return;
  }
};
