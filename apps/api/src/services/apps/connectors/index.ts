import type {
	RecipeConnectorManifest,
	RecipeConnectorProvider,
	RecipeConnectorStatus,
} from "@assistant/schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import {
	getConnectorProviderOperationAccess,
	isComposioOAuthAuthConfig,
	type ConnectorProviderConfig,
} from "~/lib/providers/capabilities/connectors";
import {
	completeComposioAuthorization,
	createComposioConnectLink,
	deleteComposioToolSession,
	disconnectComposioAccount,
	type ComposioConnectedAccount,
	isComposioConfigured,
	isComposioProviderConfigured,
	listComposioConnectedAccounts,
} from "~/lib/providers/capabilities/connectors/composio/client";
import type { ProviderConnectionRecord } from "~/repositories/ProviderConnectionRepository";
import { decryptJsonPayload, encryptJsonPayload, type EncryptedJsonPayload } from "~/utils/crypto";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";
import {
	getRecipeConnectorProviderConfig,
	getRecipeConnectorProviderConfigs,
} from "./connector-adapters";

const RECIPE_CONNECTOR_CONNECTION_KIND = "recipe_connector";
const COMPOSIO_CONNECTION_SESSION_TTL_MS = 60 * 60 * 1000;

export interface ConnectorTokenPayload {
	accessToken: string;
	scope?: string;
	connectedAt: string;
	updatedAt: string;
}

function requireJwtSecret(context: ServiceContext): string {
	if (!context.env.JWT_SECRET) {
		throw new AssistantError("JWT secret not configured", ErrorType.CONFIGURATION_ERROR);
	}
	return context.env.JWT_SECRET;
}

function getConnectorKeyMaterial(params: {
	jwtSecret: string;
	userId: number;
	providerId: RecipeConnectorProvider;
}): string {
	return `${params.jwtSecret}:${params.userId}:recipe-connector:${params.providerId}`;
}

function normaliseReturnTo(returnTo?: string): string {
	if (!returnTo?.trim()) return "/profile?tab=providers&type=connector";
	try {
		const parsed = new URL(returnTo, "https://polychat.local");
		if (parsed.origin !== "https://polychat.local") {
			return "/profile?tab=providers&type=connector";
		}
		return `${parsed.pathname}${parsed.search}${parsed.hash}`;
	} catch {
		return "/profile?tab=providers&type=connector";
	}
}

function getApiBaseUrl(context: ServiceContext, requestUrl?: string): string {
	const configured = context.env.API_BASE_URL?.trim().replace(/\/$/, "");
	if (configured) return configured;
	if (requestUrl) return new URL(requestUrl).origin;
	throw new AssistantError("API base URL not configured", ErrorType.CONFIGURATION_ERROR);
}

function getAppBaseUrl(context: ServiceContext): string {
	return context.env.APP_BASE_URL?.trim().replace(/\/$/, "") || "https://polychat.app";
}

function parseStoredConnector(record: ProviderConnectionRecord | undefined): {
	encrypted?: EncryptedJsonPayload;
} | null {
	if (!record) return null;
	const parsed = safeParseJson(record.encrypted_data);
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
	return parsed as { encrypted?: EncryptedJsonPayload };
}

async function readStoredToken(
	context: ServiceContext,
	userId: number,
	providerId: RecipeConnectorProvider,
): Promise<{ record: ProviderConnectionRecord; token: ConnectorTokenPayload } | null> {
	const record = await context.repositories.providerConnections.getConnection(
		userId,
		providerId,
		RECIPE_CONNECTOR_CONNECTION_KIND,
	);
	const stored = parseStoredConnector(record ?? undefined);
	if (!record || !stored?.encrypted) return null;

	const decrypted = await decryptJsonPayload({
		keyMaterial: getConnectorKeyMaterial({
			jwtSecret: requireJwtSecret(context),
			userId,
			providerId,
		}),
		encrypted: stored.encrypted,
		invalidMessage: "Connector payload is invalid",
		reconnectMessage: "Connector credentials could not be decrypted. Reconnect this provider.",
	});
	if (typeof decrypted.accessToken !== "string" || !decrypted.accessToken) return null;

	return {
		record,
		token: {
			accessToken: decrypted.accessToken,
			scope: typeof decrypted.scope === "string" ? decrypted.scope : undefined,
			connectedAt:
				typeof decrypted.connectedAt === "string" ? decrypted.connectedAt : record.created_at,
			updatedAt: typeof decrypted.updatedAt === "string" ? decrypted.updatedAt : record.updated_at,
		},
	};
}

async function writeStoredToken(params: {
	context: ServiceContext;
	userId: number;
	providerId: RecipeConnectorProvider;
	payload: ConnectorTokenPayload;
}) {
	const encrypted = await encryptJsonPayload({
		keyMaterial: getConnectorKeyMaterial({
			jwtSecret: requireJwtSecret(params.context),
			userId: params.userId,
			providerId: params.providerId,
		}),
		payload: { ...params.payload },
	});
	const created = await params.context.repositories.providerConnections.upsertConnection({
		userId: params.userId,
		provider: params.providerId,
		kind: RECIPE_CONNECTOR_CONNECTION_KIND,
		encryptedData: { encrypted },
	});
	return created.id;
}

async function getConnectorStatus(
	context: ServiceContext,
	userId: number,
	provider: ConnectorProviderConfig,
	composioAccounts?: ComposioConnectedAccount[],
): Promise<{
	status: RecipeConnectorStatus;
	connectedAt?: string;
	updatedAt?: string;
}> {
	if (provider.auth.authType === "composio") {
		if (!isComposioProviderConfigured(context.env, provider)) return { status: "unconfigured" };
		const toolkitSlug = provider.auth.toolkitSlug;
		const authConfigIds = provider.auth.authConfigs.map((config) => config.id);
		const accounts =
			composioAccounts ??
			(await listComposioConnectedAccounts({
				env: context.env,
				userId,
				toolkitSlugs: [toolkitSlug],
				authConfigIds,
			}));
		const account = accounts.find(
			(item) =>
				item.toolkitSlug === toolkitSlug &&
				item.authConfigId != null &&
				authConfigIds.includes(item.authConfigId) &&
				item.status === "ACTIVE" &&
				!item.isDisabled,
		);
		return account
			? { status: "connected", connectedAt: account.createdAt, updatedAt: account.updatedAt }
			: { status: "disconnected" };
	}

	const stored = await readStoredToken(context, userId, provider.id);
	return stored
		? {
				status: "connected",
				connectedAt: stored.token.connectedAt,
				updatedAt: stored.token.updatedAt,
			}
		: { status: "disconnected" };
}

export async function listRecipeConnectors(params: {
	context: ServiceContext;
	userId: number;
	requestUrl?: string;
}): Promise<{ connectors: RecipeConnectorManifest[] }> {
	params.context.ensureDatabase();
	const composioAccounts = isComposioConfigured(params.context.env)
		? await listComposioConnectedAccounts({
				env: params.context.env,
				userId: params.userId,
			})
		: [];

	const connectors: RecipeConnectorManifest[] = [];
	for (const provider of getRecipeConnectorProviderConfigs()) {
		const state = await getConnectorStatus(
			params.context,
			params.userId,
			provider,
			composioAccounts,
		);
		connectors.push({
			id: provider.id,
			name: provider.name,
			description: provider.description,
			logoUrl: provider.logoUrl,
			appUrl: provider.appUrl,
			categories: [...provider.categories],
			authType: provider.auth.authType,
			status: state.status,
			setupUrl: provider.setupUrl,
			authorizationUrl: undefined,
			connectedAt: state.connectedAt,
			updatedAt: state.updatedAt,
			credentialLabel:
				provider.auth.authType === "api_key" ? provider.auth.credentialLabel : undefined,
			scopes: [...provider.auth.scopes],
			toolCount: provider.operations.length,
			readToolCount: provider.operations.filter((operation) => operation.access === "read").length,
			writeToolCount: provider.operations.filter((operation) => operation.access === "write")
				.length,
			operationAccess: getConnectorProviderOperationAccess(provider),
			authConfigs:
				provider.auth.authType === "composio"
					? provider.auth.authConfigs.map((authConfig) => ({
							...authConfig,
							status: composioAccounts.some(
								(account) =>
									account.authConfigId === authConfig.id &&
									account.status === "ACTIVE" &&
									!account.isDisabled,
							)
								? ("connected" as const)
								: state.status === "unconfigured"
									? ("unconfigured" as const)
									: ("disconnected" as const),
						}))
					: [],
		});
	}
	return { connectors };
}

export async function startRecipeConnectorAuthorization(params: {
	context: ServiceContext;
	userId: number;
	provider: RecipeConnectorProvider;
	authConfigId?: string;
	returnTo?: string;
	requestUrl?: string;
}) {
	const provider = getRecipeConnectorProviderConfig(params.provider);
	if (!provider)
		throw new AssistantError("Unknown connector provider", ErrorType.PARAMS_ERROR, 400);

	if (provider.auth.authType === "composio") {
		if (!isComposioProviderConfigured(params.context.env, provider)) {
			throw new AssistantError("Connector is not configured", ErrorType.CONFIGURATION_ERROR);
		}
		const authConfig = params.authConfigId
			? provider.auth.authConfigs.find((config) => config.id === params.authConfigId)
			: provider.auth.authConfigs.length === 1
				? provider.auth.authConfigs[0]
				: undefined;
		if (!authConfig) {
			throw new AssistantError(
				params.authConfigId ? "Unknown connector auth config" : "Connector auth config is required",
				ErrorType.PARAMS_ERROR,
				400,
			);
		}
		const callbackUrl = isComposioOAuthAuthConfig(authConfig)
			? `${getApiBaseUrl(params.context, params.requestUrl)}/apps/connectors/composio/verify`
			: new URL(normaliseReturnTo(params.returnTo), getAppBaseUrl(params.context)).toString();
		const link = await createComposioConnectLink({
			env: params.context.env,
			userId: params.userId,
			provider,
			authConfigId: authConfig.id,
			callbackUrl,
		});
		if (link.sessionId) {
			const now = Date.now();
			try {
				await params.context.repositories.composioConnectorSessions.create({
					remoteSessionId: link.sessionId,
					kind: "connection",
					userId: params.userId,
					provider: provider.id,
					toolkitSlug: provider.auth.toolkitSlug,
					authConfigId: authConfig.id,
					connectedAccountId: link.connectedAccountId,
					allowedOperationIds: [],
					runId: params.context.connectorRunId,
					createdAt: new Date(now).toISOString(),
					expiresAt: new Date(now + COMPOSIO_CONNECTION_SESSION_TTL_MS).toISOString(),
				});
			} catch (error) {
				await deleteComposioToolSession({
					env: params.context.env,
					sessionId: link.sessionId,
				}).catch(() => undefined);
				throw error;
			}
		}
		return { provider: params.provider, authorizationUrl: link.redirectUrl };
	}

	throw new AssistantError("Connector uses API-key setup", ErrorType.PARAMS_ERROR, 400);
}

export async function verifyComposioConnectorAuthorization(params: {
	context: ServiceContext;
	userId: number;
	sessionUri?: string;
	status?: "success" | "failed";
	connectedAccountId?: string;
}) {
	let completedAccount: ComposioConnectedAccount | undefined;
	if (params.sessionUri) {
		const completed = await completeComposioAuthorization({
			env: params.context.env,
			userId: params.userId,
			sessionUri: params.sessionUri,
		});
		const accounts = await listComposioConnectedAccounts({
			env: params.context.env,
			userId: params.userId,
			toolkitSlugs: [completed.toolkitSlug],
			connectedAccountIds: [completed.connectedAccountId],
		});
		completedAccount = accounts.find((account) => account.id === completed.connectedAccountId);
	} else {
		if (params.status !== "success" || !params.connectedAccountId) {
			throw new AssistantError(
				"Composio connection was not completed",
				ErrorType.AUTHORISATION_ERROR,
				400,
			);
		}
		const accounts = await listComposioConnectedAccounts({
			env: params.context.env,
			userId: params.userId,
			connectedAccountIds: [params.connectedAccountId],
		});
		completedAccount = accounts.find((account) => account.id === params.connectedAccountId);
	}
	if (!completedAccount || completedAccount.status !== "ACTIVE" || completedAccount.isDisabled) {
		throw new AssistantError(
			"Composio connection verification failed",
			ErrorType.AUTHORISATION_ERROR,
			403,
		);
	}
	const provider = getRecipeConnectorProviderConfigs().find(
		(item) =>
			item.auth.authType === "composio" &&
			item.auth.toolkitSlug === completedAccount.toolkitSlug &&
			completedAccount?.authConfigId != null &&
			item.auth.authConfigs.some((config) => config.id === completedAccount.authConfigId),
	);
	if (!provider || provider.auth.authType !== "composio") {
		throw new AssistantError(
			"Composio returned an unsupported auth config",
			ErrorType.AUTHORISATION_ERROR,
			403,
		);
	}
	const redirectUrl = new URL(
		"/profile?tab=providers&type=connector",
		getAppBaseUrl(params.context),
	);
	redirectUrl.searchParams.set("connector", provider.id);
	redirectUrl.searchParams.set("connected", "1");
	return redirectUrl.toString();
}

export async function deleteRecipeConnectorConnection(params: {
	context: ServiceContext;
	userId: number;
	provider: RecipeConnectorProvider;
}) {
	const provider = getRecipeConnectorProviderConfig(params.provider);
	if (!provider)
		throw new AssistantError("Unknown connector provider", ErrorType.PARAMS_ERROR, 400);
	if (provider.auth.authType === "composio") {
		const authConfigIds = provider.auth.authConfigs.map((config) => config.id);
		const accounts = await listComposioConnectedAccounts({
			env: params.context.env,
			userId: params.userId,
			toolkitSlugs: [provider.auth.toolkitSlug],
			authConfigIds,
		});
		for (const account of accounts) {
			const authConfig = provider.auth.authConfigs.find(
				(config) => config.id === account.authConfigId,
			);
			await disconnectComposioAccount({
				env: params.context.env,
				connectedAccountId: account.id,
				revokeAtProvider:
					authConfig != null &&
					isComposioOAuthAuthConfig(authConfig) &&
					account.status !== "REVOKED",
			});
		}
		return { success: true };
	}

	await params.context.repositories.providerConnections.deleteConnection(
		params.userId,
		params.provider,
		RECIPE_CONNECTOR_CONNECTION_KIND,
	);
	return { success: true };
}

export async function storeRecipeConnectorApiKey(params: {
	context: ServiceContext;
	userId: number;
	provider: RecipeConnectorProvider;
	apiKey: string;
}) {
	const provider = getRecipeConnectorProviderConfig(params.provider);
	if (!provider || provider.auth.authType !== "api_key") {
		throw new AssistantError("Connector does not use API-key setup", ErrorType.PARAMS_ERROR, 400);
	}
	const apiKey = params.apiKey.trim();
	if (!apiKey)
		throw new AssistantError("Connector API key is required", ErrorType.PARAMS_ERROR, 400);

	const now = new Date().toISOString();
	await writeStoredToken({
		context: params.context,
		userId: params.userId,
		providerId: params.provider,
		payload: {
			accessToken: apiKey,
			scope: provider.auth.scopes.join(" "),
			connectedAt: now,
			updatedAt: now,
		},
	});
	return { success: true };
}

export async function getRecipeConnectorAccessToken(params: {
	context: ServiceContext;
	userId: number;
	provider: RecipeConnectorProvider;
}) {
	const provider = getRecipeConnectorProviderConfig(params.provider);
	if (!provider || provider.auth.authType !== "api_key") {
		throw new AssistantError(
			"Connector does not expose stored credentials",
			ErrorType.PARAMS_ERROR,
			400,
		);
	}
	const stored = await readStoredToken(params.context, params.userId, params.provider);
	if (!stored) {
		throw new AssistantError("Connector is not connected", ErrorType.AUTHORISATION_ERROR, 403);
	}
	return stored.token;
}
