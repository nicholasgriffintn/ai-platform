import {
  AUTOMATION_CREATE_TOOL_NAME,
  createAutomationInputSchema,
} from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "./types";

export const create_automation: FunctionToolDescriptor = {
  name: AUTOMATION_CREATE_TOOL_NAME,
  description:
    "Set up standing work that runs on a schedule, from a description of when it should run and what it should do. Agree the schedule and the instruction with the user first, and say the schedule back to them in words before calling this. Use discover_capabilities to find which recipe runs the work.",
  type: "premium",
  permissions: ["write"],
  inputSchema: createAutomationInputSchema,
};
