import { teammateComputerInputSchema } from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { FunctionToolDescriptor } from "./types";

export const use_computer: FunctionToolDescriptor = {
  name: "use_computer",
  description:
    "Observe or control the hosted computer assigned to this teammate context. Navigation, scrolling and waiting can run unattended. Clicking, typing and key input suspend for supervised takeover because their external effect cannot be verified. Use connector tools for structured external account changes.",
  type: "premium",
  permissions: ["sandbox", "write"],
  inputSchema: z.discriminatedUnion("operation", [
    z.object({ operation: z.literal("observe") }),
    z.object({ operation: z.literal("input"), input: teammateComputerInputSchema }),
    z.object({
      operation: z.literal("request_takeover"),
      reason: z.string().min(1).max(500),
    }),
  ]),
};
