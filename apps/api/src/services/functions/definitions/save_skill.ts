import { saveSkillInputSchema, SKILL_SAVE_TOOL_NAME } from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "./types";

export const save_skill: FunctionToolDescriptor = {
  name: SKILL_SAVE_TOOL_NAME,
  description:
    "Save the way something was just done as a reusable skill, so it can be loaded next time instead of re-explained. Agree the name, the description and the instructions with the user before calling this. Write the instructions for whoever runs them next, not as a summary of this conversation. In a project conversation the skill belongs to the project; otherwise it is personal.",
  type: "normal",
  permissions: ["write"],
  inputSchema: saveSkillInputSchema,
};
