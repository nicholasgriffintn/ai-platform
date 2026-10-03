import {
  BedrockManagedAgentsClient,
  parseAwsSessionCredentials,
  validateAwsCredentials,
  type BedrockManagedAgentsClientOptions,
  type AwsCredentials,
} from "@ngriffin_uk/polychat-ai-providers";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

export async function resolveManagedAgentCredentials(
  context: ServiceContext,
  projectId?: string,
  write = false,
): Promise<AwsCredentials> {
  const user = context.requireUser();

  if (projectId) {
    const { project } = await requireProjectAccess(
      context,
      projectId,
      write ? ["owner", "admin"] : undefined,
    );
    const values = await context.repositories.modelConnections.getSecrets(
      project.workspace_id,
      "aws",
    );

    if (!values.accessKeyId || !values.secretAccessKey) {
      throw new AssistantError(
        "Connect AWS under Models › Governance in this workspace",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    return validateAwsCredentials({
      accessKey: values.accessKeyId,
      secretKey: values.secretAccessKey,
      ...(values.sessionToken ? { sessionToken: values.sessionToken } : {}),
    });
  }

  const value = await context.repositories.userSettings.getProviderApiKey(user.id, "bedrock");

  if (!value) {
    throw new AssistantError(
      "Add your Amazon Bedrock credentials in provider settings",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return parseAwsSessionCredentials(value);
}

export function createManagedAgentsClient(
  context: ServiceContext,
  region: BedrockManagedAgentsClientOptions["region"],
  projectId?: string,
  write = false,
): BedrockManagedAgentsClient {
  return new BedrockManagedAgentsClient({
    region,
    credentials: () => resolveManagedAgentCredentials(context, projectId, write),
  });
}
