import { ApiKeyRepository } from "~/repositories/ApiKeyRepository";
import { IEnv } from "~/types";

export async function getUserApiKeys(
  env: IEnv,
  userId: number,
): Promise<any[]> {
  const apiKeyRepo = new ApiKeyRepository(env);
  return await apiKeyRepo.getUserApiKeys(userId);
}

export async function createUserApiKey(
  env: IEnv,
  userId: number,
  name: string,
): Promise<{ plaintextKey: string; metadata: any }> {
  const apiKeyRepo = new ApiKeyRepository(env);
  return await apiKeyRepo.createApiKey(userId, name);
}

export async function deleteUserApiKey(
  env: IEnv,
  userId: number,
  keyId: string,
): Promise<void> {
  const apiKeyRepo = new ApiKeyRepository(env);
  await apiKeyRepo.deleteApiKey(userId, keyId);
}
