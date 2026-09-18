import { teammateComputerInputSchema } from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { FunctionToolDescriptor } from "./types";

export const use_computer: FunctionToolDescriptor = {
  name: "use_computer",
  maxIdenticalCalls: 20,
  description:
    "Observe or control the hosted computer assigned to this teammate context. Use operation read to get the visible text of the current page before answering questions about it; a screenshot is not readable text. Navigation, scrolling, clicking, waiting and navigation keys run unattended. Typing text and committing keys (Return, Tab, paste) suspend for supervised takeover because they change external systems. Use operation wait with durationMs to let pages finish loading. Use connector tools for structured external account changes. The first call in a context boots a hosted Chromium desktop and is slow; batch navigation into one call and prefer wait over repeated observations to conserve steps.",
  type: "premium",
  permissions: ["sandbox", "write"],
  inputSchema: z.discriminatedUnion("operation", [
    z.object({ operation: z.literal("observe") }),
    z.object({ operation: z.literal("read") }),
    z.object({ operation: z.literal("input"), input: teammateComputerInputSchema }),
    z.object({
      operation: z.literal("wait"),
      durationMs: z.number().int().min(100).max(10_000),
    }),
    z.object({
      operation: z.literal("request_takeover"),
      reason: z.string().min(1).max(500),
    }),
  ]),
};
