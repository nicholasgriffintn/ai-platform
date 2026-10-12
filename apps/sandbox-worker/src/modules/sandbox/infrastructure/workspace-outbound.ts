import {
  containerEgressBlockedResponse,
  decideContainerEgress,
  type ContainerEgressPolicy,
} from "@ngriffin_uk/polychat-library-sandbox";
import { WorkerEntrypoint } from "cloudflare:workers";

import type { Env } from "../../../types";
import { forwardBrokeredGit, isBrokeredGitRequest, type WorkspaceGitBroker } from "./brokered-git";

export interface WorkspaceOutboundProps {
  workspaceId: string;
  policy: ContainerEgressPolicy;
  gitBroker?: WorkspaceGitBroker;
}

function blockedResponse(reason: string): Response {
  return containerEgressBlockedResponse(
    reason,
    "Add the host to networkHosts in the project's environment configuration if the run needs it.",
  );
}

export class WorkspaceOutbound extends WorkerEntrypoint<Env, WorkspaceOutboundProps> {
  private async recordBlocked(host: string): Promise<void> {
    await this.env.WORKSPACE.get(this.env.WORKSPACE.idFromString(this.ctx.props.workspaceId))
      .recordBlockedEgress(host)
      .catch((error: unknown) => {
        console.warn("[workspace-egress] Failed to record blocked host", {
          host,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const broker = this.ctx.props.gitBroker;

    if (broker && url.hostname === broker.host) {
      if (isBrokeredGitRequest(request, broker)) {
        return forwardBrokeredGit(request, broker, this.env.POLYCHAT_API);
      }

      await this.recordBlocked(url.hostname);

      return blockedResponse(`only repository git traffic may reach ${url.hostname}`);
    }

    const decision = decideContainerEgress(this.ctx.props.policy, {
      url,
      method: request.method,
    });

    if (decision.kind === "allow") {
      return fetch(request);
    }

    await this.recordBlocked(url.hostname);

    return blockedResponse(decision.reason);
  }
}
