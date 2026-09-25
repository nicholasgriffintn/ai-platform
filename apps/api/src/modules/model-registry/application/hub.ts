import { HuggingFaceHubClient } from "@ngriffin_uk/polychat-ai-model-sources";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import type { IEnv } from "~/types";

import { resolveHuggingFace } from "./credentials";

export async function workspaceHubClient(
  env: IEnv,
  repositories: RepositoryManager,
  workspaceId: string,
): Promise<HuggingFaceHubClient> {
  const { token } = await resolveHuggingFace(env, repositories, workspaceId);

  return new HuggingFaceHubClient({ token });
}
