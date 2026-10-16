import { jsonSchemaToZod } from "@ngriffin_uk/polychat-library-tools";
import { CURRENT_TIME_TOOL_NAME } from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "./types";

export const get_current_time: FunctionToolDescriptor = {
  name: CURRENT_TIME_TOOL_NAME,
  description:
    "Returns the current date, time, weekday and UTC offset. Call it whenever the answer depends on today's date or the time, including resolving relative dates such as 'next Friday' or 'in three weeks'. Pass an IANA timezone to get local time; it defaults to UTC.",
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      timezone: {
        type: "string",
        description: 'IANA timezone, for example "Europe/London" or "America/New_York".',
      },
    },
  }),
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
};
