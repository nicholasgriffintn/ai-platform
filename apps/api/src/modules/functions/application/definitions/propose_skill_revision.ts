import {
  proposeSkillRevisionInputSchema,
  SKILL_REVISE_TOOL_NAME,
} from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "./types";

export const propose_skill_revision: FunctionToolDescriptor = {
  name: SKILL_REVISE_TOOL_NAME,
  description:
    "When the user corrects something a skill told you to do, propose the corrected playbook so the same mistake does not repeat. This saves a draft for the user to review; it does not change what the skill does until they accept it. Only use it for a correction the user actually made, never to tidy a skill you were not asked about.",
  type: "normal",
  permissions: ["write"],
  inputSchema: proposeSkillRevisionInputSchema,
};
