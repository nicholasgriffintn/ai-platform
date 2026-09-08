import z from "zod/v4";

import type { FunctionToolDescriptor } from "./types";

const messageParentInputSchema = z.object({
  message: z.string().trim().min(1).max(8000),
});

export const messageParent: FunctionToolDescriptor = {
  name: "message_parent",
  description:
    "Send a message to the parent conversation through the handle granted to this delegate. Use only when the parent needs a material update.",
  type: "normal",
  permissions: [],
  inputSchema: messageParentInputSchema,
};
