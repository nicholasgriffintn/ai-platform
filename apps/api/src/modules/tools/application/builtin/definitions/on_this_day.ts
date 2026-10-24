import z from "zod/v4";

import type { FunctionToolDescriptor } from "~/types/functions";

export const get_on_this_day: FunctionToolDescriptor = {
  name: "get_on_this_day",
  description:
    "List notable events that happened on a calendar day in past years, from Wikipedia's On this day feed, with a link for each. Returns data only; interpret it yourself.",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  inputSchema: z.object({
    date: z.iso
      .date()
      .optional()
      .describe(
        "The day as YYYY-MM-DD; only the month and day are used. Defaults to today in UTC.",
      ),
    count: z.number().int().min(1).max(20).default(5).describe("How many events to return."),
  }),
};
