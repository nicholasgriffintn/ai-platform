import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import { retrieveOnThisDay } from "~/modules/tools/application/retrieval/on-this-day";
import type { ApiToolDefinition } from "~/types/functions";

import { get_on_this_day as get_on_this_dayDescriptor } from "./definitions/on_this_day";

export const get_on_this_day: ApiToolDefinition = {
  ...get_on_this_dayDescriptor,
  execute: async (args) => {
    const date = typeof args.date === "string" ? args.date : new Date().toISOString().slice(0, 10);
    const count = Number(args.count) || 5;

    try {
      const events = await retrieveOnThisDay(date, count);

      return {
        status: "success",
        name: get_on_this_dayDescriptor.name,
        content:
          events.length > 0
            ? events
                .map(
                  (event) =>
                    `${event.year ?? "Undated"}: ${event.text}${event.url ? ` (${event.url})` : ""}`,
                )
                .join("\n")
            : "No events are listed for that day.",
        data: { date, events },
      };
    } catch (error) {
      return {
        status: "error",
        name: get_on_this_dayDescriptor.name,
        content: getErrorMessage(error),
        data: { date, events: [] },
      };
    }
  },
};
