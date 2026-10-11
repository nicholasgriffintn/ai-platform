import {
  PROPOSE_CORRECTION_TOOL_NAME,
  proposeCorrectionInputSchema,
} from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "./types";

export const propose_correction: FunctionToolDescriptor = {
  name: PROPOSE_CORRECTION_TOOL_NAME,
  description:
    "When the user corrects how you work, record the rule so the same mistake does not repeat. State the rule as one sentence that applies beyond this answer and quote the user's words exactly. Place it in a skill when a skill's playbook caused the mistake (this saves a draft for them to accept), otherwise in memory. If the same rule was already recorded, the result says so; then the earlier placement did not hold and a skill is the stronger home. Only use it for a correction the user actually made.",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "draft" },
  intentEvidence: (input) => ({
    operation: PROPOSE_CORRECTION_TOOL_NAME,
    pattern: input.pattern,
    placement: input.placement?.type,
    skill: input.placement?.type === "skill" ? input.placement.name : undefined,
  }),
  inputSchema: proposeCorrectionInputSchema,
};
