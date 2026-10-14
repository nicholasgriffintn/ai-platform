import {
  getTeammateComputer,
  getTeammateComputerViewScreen,
  performTeammateComputerAction,
  releaseTeammateComputer,
  takeOverTeammateComputer,
} from "~/modules/teammates/application";

import type { EnvironmentKindDefinition } from "../../domain/environment-kind";

export const teammateComputerEnvironments: EnvironmentKindDefinition<"teammate_computer"> = {
  kind: "teammate_computer",
  actions: new Set([
    "provision",
    "observe",
    "checkpoint",
    "restore",
    "stop",
    "destroy",
    "takeover",
    "view",
    "release",
  ]),
  async read({ context }, id) {
    return {
      object: "environment",
      id,
      kind: "teammate_computer",
      detail: await getTeammateComputer(context, id),
    };
  },
  async act({ context }, id, action) {
    switch (action.action) {
      case "provision":
      case "observe":
      case "checkpoint":
      case "restore":
      case "stop":
      case "destroy":
        return performTeammateComputerAction(context, id, { action: action.action });
      case "takeover":
        return takeOverTeammateComputer(context, id, action.record_teaching);
      case "view":
        return getTeammateComputerViewScreen(context, id);
      case "release":
        return releaseTeammateComputer(context, id, action.fence);
      default:
        return null;
    }
  },
};
