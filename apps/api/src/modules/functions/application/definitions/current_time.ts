import { jsonSchemaToZod } from "@ngriffin_uk/polychat-library-tools";
import { CURRENT_TIME_TOOL_NAME } from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "./types";

export const get_current_time: FunctionToolDescriptor = {
  name: CURRENT_TIME_TOOL_NAME,
  description:
    "Returns the current date, time, weekday and UTC offset. Call it whenever the answer depends on the date or time, including relative dates such as 'next Friday'.",
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      timezone: {
        type: "string",
        description: 'IANA timezone such as "Europe/London". Defaults to UTC.',
      },
    },
  }),
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
};
