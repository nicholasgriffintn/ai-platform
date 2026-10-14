import {
  destroyBrowserSession,
  inspectBrowserSession,
  respondToBrowserApproval,
  stopBrowserSession,
} from "~/modules/computer-use/application/sessions";

import type { EnvironmentKindDefinition } from "../../domain/environment-kind";

export const browserEnvironments: EnvironmentKindDefinition<"browser"> = {
  kind: "browser",
  actions: new Set(["stop", "approve"]),
  async read({ context }, id) {
    return {
      object: "environment",
      id,
      kind: "browser",
      detail: await inspectBrowserSession(context, id),
    };
  },
  remove: ({ context }, id) => destroyBrowserSession(context, id),
  async act({ context }, id, action) {
    if (action.action === "stop") {
      return stopBrowserSession(context, id);
    }

    if (action.action === "approve") {
      return respondToBrowserApproval(context, id, {
        requestId: action.request_id,
        response: action.response,
      });
    }

    return null;
  },
};
