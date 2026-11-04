const HAND_RUN_EXCLUDED_TOOLS = new Set<string>([
  "complete_goal",
  "propose_correction",
  "save_skill",
  "set_goal",
]);

export function isRunnableByHand(tool: { name: string; system?: boolean }): boolean {
  return !tool.system && !HAND_RUN_EXCLUDED_TOOLS.has(tool.name);
}
