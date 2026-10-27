import {
  PROJECT_TASK_TOOL_IDS,
  WORK_AGENT_TOOL_IDS,
  WORK_RUN_EXCLUDED_TOOL_IDS,
  WORK_TASK_TOOL_IDS,
} from "@ngriffin_uk/polychat-schemas";
import { excludeEnabledTools } from "@ngriffin_uk/polychat-utility-server/enabled-tools";

export const WORK_BOARD_TOOL_IDS: readonly string[] = [
  ...PROJECT_TASK_TOOL_IDS,
  ...WORK_TASK_TOOL_IDS,
];

export function buildWorkRunTools(teammateTools: readonly string[]): string[] {
  return excludeEnabledTools(
    [...new Set([...teammateTools, ...WORK_AGENT_TOOL_IDS, ...WORK_BOARD_TOOL_IDS])],
    WORK_RUN_EXCLUDED_TOOL_IDS,
  );
}

export function grantWorkBoardTools(approvedTools: readonly string[] | undefined): string[] {
  return [...new Set([...(approvedTools ?? []), ...WORK_BOARD_TOOL_IDS])];
}
