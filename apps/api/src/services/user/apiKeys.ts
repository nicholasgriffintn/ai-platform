import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ApiKeyMetadata } from "~/repositories/ApiKeyRepository";

export async function getUserApiKeys(
	context: ServiceContext,
	userId?: number,
): Promise<ApiKeyMetadata[]> {
	context.ensureDatabase();
	const id = userId ?? context.requireUser().id;
	return context.repositories.apiKeys.getUserApiKeys(id);
}

export async function createUserApiKey(
	context: ServiceContext,
	name: string,
	userId?: number,
): Promise<{ plaintextKey: string; metadata: ApiKeyMetadata }> {
	context.ensureDatabase();
	const id = userId ?? context.requireUser().id;
	return context.repositories.apiKeys.createApiKey(id, name);
}

export async function deleteUserApiKey(
	context: ServiceContext,
	keyId: string,
	userId?: number,
): Promise<void> {
	context.ensureDatabase();
	const id = userId ?? context.requireUser().id;
	await context.repositories.apiKeys.deleteApiKey(id, keyId);
}
