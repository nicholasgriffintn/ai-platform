import { loadSkillInputSchema, SKILL_LOAD_TOOL_NAME } from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "./types";

export const load_skill: FunctionToolDescriptor = {
  name: SKILL_LOAD_TOOL_NAME,
  description:
    "Load the full SKILL.md instructions for one of the skills listed in available_skills, or one relative resource path listed by that skill. Call this before starting work the skill covers, and follow what it returns.",
  type: "normal",
  costPerCall: 0,
  maxIdenticalCalls: 1,
  permissions: ["read"],
  inputSchema: loadSkillInputSchema,
};
