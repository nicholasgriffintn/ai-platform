import type { PullRequestLocator } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { githubTaskIntegration } from "./github";
import { linearTaskIntegration } from "./linear";
import type { TaskIntegrationAdapter } from "./types";

const adapters: readonly TaskIntegrationAdapter[] = [githubTaskIntegration, linearTaskIntegration];

export function getTaskIntegrationAdapter(provider: string): TaskIntegrationAdapter {
  const adapter = adapters.find((candidate) => candidate.provider === provider);

  if (!adapter) {
    throw new AssistantError("Unsupported task integration provider", ErrorType.PARAMS_ERROR, 400);
  }

  return adapter;
}

export async function connectTaskReview(
  context: ServiceContext,
  locator: Omit<PullRequestLocator, "pullRequestNumber">,
) {
  const adapter = getTaskIntegrationAdapter(locator.provider);

  if (!adapter.connectReview) {
    throw new AssistantError(
      "This integration does not support pull request reviews",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return adapter.connectReview(context, locator);
}
