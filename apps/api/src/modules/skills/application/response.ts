import {
  formatSkillContent,
  formatSkillResource,
  type SkillContent,
  type SkillResource,
} from "@ngriffin_uk/polychat-ai-skills";
import {
  RESPONSE_TOOL_ACTIVATION_DATA_KEY,
  ToolResponseType,
  SKILL_LOAD_TOOL_NAME,
  type SkillResourceSummary,
  type AuthoredSkillProvenance,
} from "@ngriffin_uk/polychat-schemas";

import type { IFunctionResponse } from "~/types";

export {
  formatSkillContent,
  formatSkillResource,
  isSkillResourceWithinLoadLimit,
  MAX_SKILL_RESOURCE_CONTENT_BYTES,
  toSkillResourceSummary,
} from "@ngriffin_uk/polychat-ai-skills";

export const SKILL_INSTRUCTIONS_NEXT =
  "Follow these instructions now; they stay in effect, so do not load this skill again.";
export const SKILL_RESOURCE_NEXT =
  "Use this resource now; it stays in this conversation, so do not load it again.";

export function createSkillInstructionsResponse(
  skill: SkillContent,
  resources: SkillResourceSummary[],
  activatedTools: readonly string[] = [],
  provenance?: AuthoredSkillProvenance,
): IFunctionResponse {
  return {
    status: "success",
    name: SKILL_LOAD_TOOL_NAME,
    content: formatSkillContent(skill),
    next: SKILL_INSTRUCTIONS_NEXT,
    data: {
      responseType: ToolResponseType.HIDDEN,
      skill: skill.name,
      resources,
      [RESPONSE_TOOL_ACTIVATION_DATA_KEY]: [...activatedTools],
      ...(provenance ? { provenance } : {}),
    },
  };
}

export function createSkillResourceResponse(
  skillName: string,
  resource: SkillResource,
  resources: SkillResourceSummary[],
  provenance?: AuthoredSkillProvenance,
): IFunctionResponse {
  return {
    status: "success",
    name: SKILL_LOAD_TOOL_NAME,
    content: formatSkillResource(skillName, resource),
    next: SKILL_RESOURCE_NEXT,
    data: {
      responseType: ToolResponseType.HIDDEN,
      skill: skillName,
      resource: resource.path,
      resources,
      ...(provenance ? { provenance } : {}),
    },
  };
}
