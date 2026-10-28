import {
  agentPullRequestSchema,
  type AgentPullRequest,
  type AgentPullRequestRequest,
} from "@ngriffin_uk/polychat-schemas";

import { requestJson } from "./resource.js";

export async function openBranchPullRequest(
  request: AgentPullRequestRequest,
): Promise<AgentPullRequest> {
  return agentPullRequestSchema.parse(
    await requestJson<unknown>("/connections/github/pull_requests", "POST", request, {
      timeoutMs: null,
    }),
  );
}
