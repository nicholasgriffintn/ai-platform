export const GOAL_SET_TOOL_NAME = "set_goal";
export const GOAL_COMPLETE_TOOL_NAME = "complete_goal";

export function getEnabledGoalToolNames(params: { isProUser?: boolean }): string[] {
  if (!params.isProUser) {
    return [];
  }

  return [GOAL_SET_TOOL_NAME, GOAL_COMPLETE_TOOL_NAME];
}

export function mergeEnabledGoalToolNames(params: {
  enabledTools?: readonly string[];
  isProUser?: boolean;
}): string[] {
  return Array.from(
    new Set([
      ...(params.enabledTools ?? []),
      ...getEnabledGoalToolNames({
        isProUser: params.isProUser,
      }),
    ]),
  );
}
