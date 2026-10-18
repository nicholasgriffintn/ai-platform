import { REACT_TOOL_NAME, reactToolInputSchema } from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "~/types/functions";

export const react: FunctionToolDescriptor = {
  name: REACT_TOOL_NAME,
  description:
    "React to a message with one emoji instead of writing a short acknowledgement. React 👀 when you pick up a request you will work on, and ✅ when it is done. Never react instead of answering a question, and never treat a reaction as approval for anything.",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "draft" },
  inputSchema: reactToolInputSchema,
};
