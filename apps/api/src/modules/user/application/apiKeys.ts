import type { DeviceCredentialScope } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { ApiKeyMetadata } from "~/modules/user/infrastructure/ApiKeyRepository";
import { ApiKeyRepository } from "~/modules/user/infrastructure/ApiKeyRepository";

export async function getUserApiKeys(
  context: ServiceContext,
  userId?: number,
): Promise<ApiKeyMetadata[]> {
  context.ensureDatabase();
  const id = userId ?? context.requireUser().id;

  return context.repositories.get(ApiKeyRepository).getUserApiKeys(id);
}

export async function createUserApiKey(
  context: ServiceContext,
  name: string,
  userId?: number,
  scope: DeviceCredentialScope = "full",
): Promise<{ plaintextKey: string; metadata: ApiKeyMetadata }> {
  context.ensureDatabase();
  const id = userId ?? context.requireUser().id;

  return context.repositories.get(ApiKeyRepository).createApiKey(id, name, scope);
}

export async function deleteUserApiKey(
  context: ServiceContext,
  keyId: string,
  userId?: number,
): Promise<void> {
  context.ensureDatabase();
  const id = userId ?? context.requireUser().id;

  await context.repositories.get(ApiKeyRepository).deleteApiKey(id, keyId);
}
