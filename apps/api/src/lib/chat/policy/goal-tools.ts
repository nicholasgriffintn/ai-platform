import type { Goal } from "@ngriffin_uk/polychat-schemas";

export const GOAL_SET_TOOL_NAME = "set_goal";
export const GOAL_COMPLETE_TOOL_NAME = "complete_goal";

export function getEnabledGoalToolNames(params: {
  activeGoal?: Goal | null;
  isProUser?: boolean;
}): string[] {
  if (!params.isProUser) {
    return [];
  }

  return params.activeGoal ? [GOAL_SET_TOOL_NAME, GOAL_COMPLETE_TOOL_NAME] : [GOAL_SET_TOOL_NAME];
}

export function mergeEnabledGoalToolNames(params: {
  enabledTools?: readonly string[];
  activeGoal?: Goal | null;
  isProUser?: boolean;
}): string[] {
  return Array.from(
    new Set([
      ...(params.enabledTools ?? []),
      ...getEnabledGoalToolNames({
        activeGoal: params.activeGoal,
        isProUser: params.isProUser,
      }),
    ]),
  );
}
