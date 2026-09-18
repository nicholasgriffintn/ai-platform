import {
  listSavedMessagesInputSchema,
  SAVED_MESSAGES_TOOL_NAME,
} from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "./types";

export const list_saved_messages: FunctionToolDescriptor = {
  name: SAVED_MESSAGES_TOOL_NAME,
  description:
    "List the messages the user has kept for later, newest first. Use it when they ask you to work through what they saved, or refer to something they set aside without saying where it was.",
  type: "normal",
  permissions: ["read"],
  inputSchema: listSavedMessagesInputSchema,
};
