import { describeZonedInstant, isValidTimeZone } from "@ngriffin_uk/polychat-utility-core";

import type { ApiToolDefinition } from "~/types/functions";

import { get_current_time as get_current_timeDescriptor } from "./definitions/current_time";

export const get_current_time: ApiToolDefinition = {
  ...get_current_timeDescriptor,
  execute: async (args) => {
    const requested = typeof args.timezone === "string" ? args.timezone.trim() : "";
    const timeZone = requested || "UTC";

    if (!isValidTimeZone(timeZone)) {
      return {
        status: "error",
        name: get_current_timeDescriptor.name,
        content: `Unknown timezone "${timeZone}". Use an IANA name such as "Europe/London".`,
        data: {},
      };
    }

    const now = describeZonedInstant(new Date(), timeZone);

    return {
      status: "success",
      name: get_current_timeDescriptor.name,
      content: `${now.weekday} ${now.date} ${now.time} (${now.timeZone}, UTC${now.utcOffset})`,
      data: now,
    };
  },
};
