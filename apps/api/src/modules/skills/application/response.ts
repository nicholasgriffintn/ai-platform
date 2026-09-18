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
    data: {
      responseType: ToolResponseType.HIDDEN,
      skill: skillName,
      resource: resource.path,
      resources,
      ...(provenance ? { provenance } : {}),
    },
  };
}
