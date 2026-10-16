import { jsonSchemaToZod } from "@ngriffin_uk/polychat-library-tools";
import { USER_INFORMATION_TOOL_NAME } from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "./types";

export const get_user_information: FunctionToolDescriptor = {
  name: USER_INFORMATION_TOOL_NAME,
  description:
    "Returns what is known about the user: their location as coordinates (from their device, or approximated from their network), the location on their profile, their name, nickname and job role. Call it when the answer depends on where the user is, such as local weather, nearby places, local news or regional rules, or when you need profile details you were not given. Fields are null when unknown.",
  inputSchema: jsonSchemaToZod({ type: "object", properties: {} }),
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
};
