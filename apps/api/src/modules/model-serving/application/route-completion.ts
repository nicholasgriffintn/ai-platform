import type { ChatInvocationMessage } from "@ngriffin_uk/polychat-ai-model-providers";

import { ai } from "~/infrastructure/ai";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { notFound } from "~/modules/model-registry/application/access";
import type { ModelRouteRecord } from "~/modules/model-registry/infrastructure/ModelRouteRepository";
import { invokeDeployment } from "~/modules/model-serving/application/invocation";
import type { IEnv } from "~/types";

export async function completeWorkspaceRoute(
  env: IEnv,
  repositories: RepositoryManager,
  route: ModelRouteRecord,
  input: string,
  system: string | null,
): Promise<string> {
  if (!route.deployment_id) {
    const result = await ai.complete({
      env,
      model: route.provider_model_id,
      provider: route.provider,
      prompt: input,
      system: system ?? undefined,
    });

    return result.text;
  }

  const deployment = await repositories.modelDeployments.get(
    route.workspace_id,
    route.deployment_id,
  );

  if (!deployment || deployment.route_id !== route.id) {
    throw notFound("Route deployment");
  }

  const messages: ChatInvocationMessage[] = [];

  if (system) {
    messages.push({ role: "system", content: system });
  }

  messages.push({ role: "user", content: input });

  const result = await invokeDeployment(repositories, deployment, {
    messages,
    maxTokens: 2048,
    temperature: 0.7,
  });

  return result.text;
}
