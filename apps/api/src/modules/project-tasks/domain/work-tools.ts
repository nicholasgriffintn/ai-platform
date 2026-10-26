import {
  PROJECT_TASK_TOOL_IDS,
  WORK_RUN_EXCLUDED_TOOL_IDS,
  WORK_TASK_TOOL_IDS,
} from "@ngriffin_uk/polychat-schemas";
import { excludeEnabledTools } from "@ngriffin_uk/polychat-utility-server/enabled-tools";

export function buildWorkRunTools(teammateTools: readonly string[]): string[] {
  return excludeEnabledTools(
    [...new Set([...teammateTools, ...PROJECT_TASK_TOOL_IDS, ...WORK_TASK_TOOL_IDS])],
    WORK_RUN_EXCLUDED_TOOL_IDS,
  );
}
