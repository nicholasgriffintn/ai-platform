import { jsonSchemaToZod } from "@ngriffin_uk/polychat-library-tools";
import { USER_INFORMATION_TOOL_NAME } from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "~/types/functions";

export const get_user_information: FunctionToolDescriptor = {
  name: USER_INFORMATION_TOOL_NAME,
  description:
    "Returns the user's coordinates (device, or approximate from their network), profile location, name, nickname and job role; unknown fields are null. Call it when the answer depends on where the user is, such as weather, nearby places or regional rules.",
  inputSchema: jsonSchemaToZod({ type: "object", properties: {} }),
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
};
