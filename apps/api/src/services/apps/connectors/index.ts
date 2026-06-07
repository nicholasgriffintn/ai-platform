import jwt from "@tsndr/cloudflare-worker-jwt";
import type {
	RecipeConnectorManifest,
	RecipeConnectorProvider,
	RecipeConnectorStatus,
} from "@assistant/schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import {
	connectorProviders,
	canStartOAuthConnectorAuthorization,
	getGitHubAppInstallUrl,
	getConnectorProviderConfig,
	RECIPE_CONNECTOR_APP_ID,
	RECIPE_CONNECTOR_ITEM_TYPE,
	type ConnectorProviderConfig,
	type OAuthConnectorConfig,
} from "~/lib/providers/capabilities/connectors";
import type { AppData } from "~/repositories/AppDataRepository";
import { listGitHubAppConnectionsForUser } from "~/services/github/connections";
import { bufferToBase64 } from "~/utils/base64";
import { decryptJsonPayload, encryptJsonPayload, type EncryptedJsonPayload } from "~/utils/crypto";
import { safeParseJson } from "~/utils/json";
import { AssistantError, ErrorType } from "~/utils/errors";

const CONNECTOR_STATE_AUDIENCE = "assistant-recipe-connectors";
const CONNECTOR_STATE_EXPIRY_SECONDS = 10 * 60;
const TOKEN_EXPIRY_SKEW_SECONDS = 60;

export interface ConnectorTokenPayload {
	accessToken: string;
	refreshToken?: string;
	tokenType?: string;
	scope?: string;
	expiresAt?: number;
	connectedAt: string;
	updatedAt: string;
}

interface ConnectorStatePayload {
	sub: string;
	provider: RecipeConnectorProvider;
	returnTo: string;
	iss: "assistant";
	aud: typeof CONNECTOR_STATE_AUDIENCE;
	iat: number;
	exp: number;
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
	if (!returnTo || !returnTo.trim()) {
		return "/profile?tab=providers&type=connector";
	}

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
	if (configured) {
		return configured;
	}

	if (requestUrl) {
		return new URL(requestUrl).origin;
	}

	throw new AssistantError("API base URL not configured", ErrorType.CONFIGURATION_ERROR);
}

function getAppBaseUrl(context: ServiceContext): string {
	return context.env.APP_BASE_URL?.trim().replace(/\/$/, "") || "https://polychat.app";
}

function getOAuthCredentials(context: ServiceContext, config: OAuthConnectorConfig) {
	const clientId = context.env[config.clientIdEnv];
	const clientSecret = context.env[config.clientSecretEnv];
	if (!clientId || !clientSecret) {
		throw new AssistantError(
			"Connector OAuth client is not configured",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	return { clientId, clientSecret };
}

function buildCallbackUrl(
	context: ServiceContext,
	provider: RecipeConnectorProvider,
	requestUrl?: string,
) {
	return `${getApiBaseUrl(context, requestUrl)}/apps/connectors/${provider}/callback`;
}

async function signConnectorState(params: {
	context: ServiceContext;
	userId: number;
	provider: RecipeConnectorProvider;
	returnTo?: string;
}) {
	const now = Math.floor(Date.now() / 1000);
	const payload: ConnectorStatePayload = {
		sub: String(params.userId),
		provider: params.provider,
		returnTo: normaliseReturnTo(params.returnTo),
		iss: "assistant",
		aud: CONNECTOR_STATE_AUDIENCE,
		iat: now,
		exp: now + CONNECTOR_STATE_EXPIRY_SECONDS,
	};

	return jwt.sign(payload, requireJwtSecret(params.context), { algorithm: "HS256" });
}

async function verifyConnectorState(
	context: ServiceContext,
	state: string,
	provider: RecipeConnectorProvider,
): Promise<ConnectorStatePayload> {
	const verified = await jwt.verify(state, requireJwtSecret(context), { algorithm: "HS256" });
	if (!verified || typeof verified !== "object" || !("payload" in verified)) {
		throw new AssistantError("Connector state is invalid", ErrorType.AUTHENTICATION_ERROR, 401);
	}

	const payload = (verified as { payload: Record<string, unknown> }).payload;
	if (
		payload.iss !== "assistant" ||
		payload.aud !== CONNECTOR_STATE_AUDIENCE ||
		payload.provider !== provider ||
		typeof payload.sub !== "string" ||
		typeof payload.returnTo !== "string" ||
		typeof payload.exp !== "number" ||
		payload.exp < Math.floor(Date.now() / 1000)
	) {
		throw new AssistantError("Connector state is invalid", ErrorType.AUTHENTICATION_ERROR, 401);
	}

	return payload as unknown as ConnectorStatePayload;
}

function parseStoredConnector(record: AppData | undefined): {
	encrypted?: EncryptedJsonPayload;
} | null {
	if (!record) {
		return null;
	}

	const parsed = safeParseJson(record.data);
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		return null;
	}

	return parsed as { encrypted?: EncryptedJsonPayload };
}

async function readStoredToken(
	context: ServiceContext,
	userId: number,
	providerId: RecipeConnectorProvider,
): Promise<{ record: AppData; token: ConnectorTokenPayload } | null> {
	const records = await context.repositories.appData.getAppDataByUserAppAndItem(
		userId,
		RECIPE_CONNECTOR_APP_ID,
		providerId,
		RECIPE_CONNECTOR_ITEM_TYPE,
	);
	const record = records[0];
	const stored = parseStoredConnector(record);
	if (!record || !stored?.encrypted) {
		return null;
	}

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

	if (typeof decrypted.accessToken !== "string" || !decrypted.accessToken) {
		return null;
	}

	return {
		record,
		token: {
			accessToken: decrypted.accessToken,
			refreshToken: typeof decrypted.refreshToken === "string" ? decrypted.refreshToken : undefined,
			tokenType: typeof decrypted.tokenType === "string" ? decrypted.tokenType : undefined,
			scope: typeof decrypted.scope === "string" ? decrypted.scope : undefined,
			expiresAt: typeof decrypted.expiresAt === "number" ? decrypted.expiresAt : undefined,
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
	const data = { encrypted };
	const existing = await params.context.repositories.appData.getAppDataByUserAppAndItem(
		params.userId,
		RECIPE_CONNECTOR_APP_ID,
		params.providerId,
		RECIPE_CONNECTOR_ITEM_TYPE,
	);

	if (existing[0]) {
		await params.context.repositories.appData.updateAppData(existing[0].id, data);
		return existing[0].id;
	}

	const created = await params.context.repositories.appData.createAppDataWithItem(
		params.userId,
		RECIPE_CONNECTOR_APP_ID,
		params.providerId,
		RECIPE_CONNECTOR_ITEM_TYPE,
		data,
	);
	return created.id;
}

function getTokenExpiresAt(expiresIn: unknown): number | undefined {
	return typeof expiresIn === "number" ? Math.floor(Date.now() / 1000) + expiresIn : undefined;
}

function buildOAuthBasicAuthHeader(clientId: string, clientSecret: string): string {
	return `Basic ${bufferToBase64(new TextEncoder().encode(`${clientId}:${clientSecret}`))}`;
}

function buildOAuthTokenRequest(params: {
	config: OAuthConnectorConfig;
	clientId: string;
	clientSecret: string;
	fields: Record<string, string>;
}) {
	const tokenAuth = params.config.tokenAuth ?? "body";
	const tokenRequestFormat = params.config.tokenRequestFormat ?? "form";
	const fields =
		tokenAuth === "body"
			? {
					...params.fields,
					client_id: params.clientId,
					client_secret: params.clientSecret,
				}
			: params.fields;

	const headers: Record<string, string> = {
		Accept: "application/json",
		...(tokenRequestFormat === "json"
			? { "Content-Type": "application/json" }
			: { "Content-Type": "application/x-www-form-urlencoded" }),
		...(tokenAuth === "basic"
			? { Authorization: buildOAuthBasicAuthHeader(params.clientId, params.clientSecret) }
			: {}),
	};

	return {
		headers,
		body: tokenRequestFormat === "json" ? JSON.stringify(fields) : new URLSearchParams(fields),
	};
}

async function exchangeAuthorizationCode(params: {
	context: ServiceContext;
	provider: ConnectorProviderConfig;
	code: string;
	redirectUri: string;
}) {
	if (params.provider.auth.authType !== "oauth2") {
		throw new AssistantError("Connector does not use OAuth", ErrorType.PARAMS_ERROR);
	}

	const { clientId, clientSecret } = getOAuthCredentials(params.context, params.provider.auth);
	const request = buildOAuthTokenRequest({
		config: params.provider.auth,
		clientId,
		clientSecret,
		fields: {
			grant_type: "authorization_code",
			code: params.code,
			redirect_uri: params.redirectUri,
		},
	});

	const response = await fetch(params.provider.auth.tokenEndpoint, {
		method: "POST",
		headers: request.headers,
		body: request.body,
	});
	if (!response.ok) {
		const text = await response.text();
		throw new AssistantError(
			`Connector token exchange failed: ${text.slice(0, 300)}`,
			ErrorType.EXTERNAL_API_ERROR,
			502,
		);
	}

	return (await response.json()) as Record<string, unknown>;
}

async function refreshOAuthToken(params: {
	context: ServiceContext;
	provider: ConnectorProviderConfig;
	token: ConnectorTokenPayload;
	userId: number;
}) {
	if (params.provider.auth.authType !== "oauth2" || !params.token.refreshToken) {
		return params.token;
	}

	const { clientId, clientSecret } = getOAuthCredentials(params.context, params.provider.auth);
	const request = buildOAuthTokenRequest({
		config: params.provider.auth,
		clientId,
		clientSecret,
		fields: {
			grant_type: "refresh_token",
			refresh_token: params.token.refreshToken,
		},
	});

	const response = await fetch(params.provider.auth.tokenEndpoint, {
		method: "POST",
		headers: request.headers,
		body: request.body,
	});
	if (!response.ok) {
		return params.token;
	}

	const data = (await response.json()) as Record<string, unknown>;
	const now = new Date().toISOString();
	const refreshed: ConnectorTokenPayload = {
		...params.token,
		accessToken:
			typeof data.access_token === "string" ? data.access_token : params.token.accessToken,
		refreshToken:
			typeof data.refresh_token === "string" ? data.refresh_token : params.token.refreshToken,
		tokenType: typeof data.token_type === "string" ? data.token_type : params.token.tokenType,
		scope: typeof data.scope === "string" ? data.scope : params.token.scope,
		expiresAt: getTokenExpiresAt(data.expires_in) ?? params.token.expiresAt,
		updatedAt: now,
	};

	await writeStoredToken({
		context: params.context,
		userId: params.userId,
		providerId: params.provider.id,
		payload: refreshed,
	});

	return refreshed;
}

async function getConnectorStatus(
	context: ServiceContext,
	userId: number,
	provider: ConnectorProviderConfig,
): Promise<{
	status: RecipeConnectorStatus;
	connectedAt?: string;
	updatedAt?: string;
	authorizationUrl?: string;
}> {
	if (provider.auth.authType === "github_app") {
		const connections = await listGitHubAppConnectionsForUser(context, userId);
		return {
			status: connections.length > 0 ? "connected" : "disconnected",
			connectedAt: connections[0]?.createdAt,
			updatedAt: connections[0]?.updatedAt,
			authorizationUrl: connections.length > 0 ? undefined : getGitHubAppInstallUrl(context.env),
		};
	}

	if (!canStartOAuthConnectorAuthorization(context.env, provider.auth)) {
		return { status: "unconfigured" };
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

	const connectors: RecipeConnectorManifest[] = [];
	for (const provider of connectorProviders) {
		const state = await getConnectorStatus(params.context, params.userId, provider);
		connectors.push({
			id: provider.id,
			name: provider.name,
			description: provider.description,
			authType: provider.auth.authType,
			status: state.status,
			setupUrl: provider.setupUrl,
			authorizationUrl:
				state.status === "disconnected"
					? (
							await startRecipeConnectorAuthorization({
								context: params.context,
								userId: params.userId,
								provider: provider.id,
								requestUrl: params.requestUrl,
							})
						).authorizationUrl
					: undefined,
			connectedAt: state.connectedAt,
			updatedAt: state.updatedAt,
			scopes: provider.auth.scopes,
		});
	}

	return { connectors };
}

export async function startRecipeConnectorAuthorization(params: {
	context: ServiceContext;
	userId: number;
	provider: RecipeConnectorProvider;
	returnTo?: string;
	requestUrl?: string;
}) {
	const provider = getConnectorProviderConfig(params.provider);
	if (!provider) {
		throw new AssistantError("Unknown connector provider", ErrorType.PARAMS_ERROR, 400);
	}
	if (provider.auth.authType === "github_app") {
		return {
			provider: params.provider,
			authorizationUrl: getGitHubAppInstallUrl(params.context.env) ?? provider.setupUrl,
		};
	}
	if (!canStartOAuthConnectorAuthorization(params.context.env, provider.auth)) {
		throw new AssistantError(
			"Connector OAuth client is not configured",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	const { clientId } = getOAuthCredentials(params.context, provider.auth);
	const state = await signConnectorState({
		context: params.context,
		userId: params.userId,
		provider: params.provider,
		returnTo: params.returnTo,
	});
	const redirectUri = buildCallbackUrl(params.context, params.provider, params.requestUrl);
	const authorizationUrl = new URL(provider.auth.authorizationEndpoint);
	authorizationUrl.searchParams.set("client_id", clientId);
	authorizationUrl.searchParams.set("redirect_uri", redirectUri);
	authorizationUrl.searchParams.set("response_type", "code");
	if (provider.auth.scopes.length > 0) {
		authorizationUrl.searchParams.set(
			"scope",
			provider.auth.scopes.join(provider.auth.scopeSeparator),
		);
	}
	authorizationUrl.searchParams.set("state", state);

	for (const [key, value] of Object.entries(provider.auth.extraAuthorizationParams ?? {})) {
		authorizationUrl.searchParams.set(key, value);
	}

	return {
		provider: params.provider,
		authorizationUrl: authorizationUrl.toString(),
	};
}

export async function completeRecipeConnectorAuthorization(params: {
	context: ServiceContext;
	provider: RecipeConnectorProvider;
	code: string;
	state: string;
	requestUrl?: string;
}) {
	const provider = getConnectorProviderConfig(params.provider);
	if (!provider || provider.auth.authType !== "oauth2") {
		throw new AssistantError("Unknown OAuth connector provider", ErrorType.PARAMS_ERROR, 400);
	}

	const state = await verifyConnectorState(params.context, params.state, params.provider);
	const userId = Number.parseInt(state.sub, 10);
	if (!Number.isFinite(userId)) {
		throw new AssistantError("Connector state is invalid", ErrorType.AUTHENTICATION_ERROR, 401);
	}

	const tokenResponse = await exchangeAuthorizationCode({
		context: params.context,
		provider,
		code: params.code,
		redirectUri: buildCallbackUrl(params.context, params.provider, params.requestUrl),
	});
	if (typeof tokenResponse.access_token !== "string") {
		throw new AssistantError(
			"Connector did not return an access token",
			ErrorType.EXTERNAL_API_ERROR,
			502,
		);
	}

	const now = new Date().toISOString();
	await writeStoredToken({
		context: params.context,
		userId,
		providerId: params.provider,
		payload: {
			accessToken: tokenResponse.access_token,
			refreshToken:
				typeof tokenResponse.refresh_token === "string" ? tokenResponse.refresh_token : undefined,
			tokenType:
				typeof tokenResponse.token_type === "string" ? tokenResponse.token_type : undefined,
			scope: typeof tokenResponse.scope === "string" ? tokenResponse.scope : undefined,
			expiresAt: getTokenExpiresAt(tokenResponse.expires_in),
			connectedAt: now,
			updatedAt: now,
		},
	});

	const appBaseUrl = getAppBaseUrl(params.context);
	const redirectUrl = new URL(normaliseReturnTo(state.returnTo), appBaseUrl);
	redirectUrl.searchParams.set("connector", params.provider);
	redirectUrl.searchParams.set("connected", "1");
	return redirectUrl.toString();
}

export async function deleteRecipeConnectorConnection(params: {
	context: ServiceContext;
	userId: number;
	provider: RecipeConnectorProvider;
}) {
	const provider = getConnectorProviderConfig(params.provider);
	if (!provider) {
		throw new AssistantError("Unknown connector provider", ErrorType.PARAMS_ERROR, 400);
	}
	if (provider.auth.authType === "github_app") {
		throw new AssistantError(
			"GitHub App connections are managed from the sandbox connections tab",
			ErrorType.PARAMS_ERROR,
			400,
		);
	}

	await params.context.repositories.appData.deleteAppDataByUserAppAndItem(
		params.userId,
		RECIPE_CONNECTOR_APP_ID,
		params.provider,
		RECIPE_CONNECTOR_ITEM_TYPE,
	);

	return { success: true };
}

export async function getRecipeConnectorAccessToken(params: {
	context: ServiceContext;
	userId: number;
	provider: RecipeConnectorProvider;
}) {
	const provider = getConnectorProviderConfig(params.provider);
	if (!provider || provider.auth.authType !== "oauth2") {
		throw new AssistantError("Connector is not an OAuth provider", ErrorType.PARAMS_ERROR, 400);
	}
	if (!canStartOAuthConnectorAuthorization(params.context.env, provider.auth)) {
		throw new AssistantError(
			"Connector OAuth client is not configured",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	const stored = await readStoredToken(params.context, params.userId, params.provider);
	if (!stored) {
		throw new AssistantError("Connector is not connected", ErrorType.AUTHORISATION_ERROR, 403);
	}

	const expiresAt = stored.token.expiresAt;
	if (expiresAt && expiresAt <= Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SKEW_SECONDS) {
		return refreshOAuthToken({
			context: params.context,
			provider,
			token: stored.token,
			userId: params.userId,
		});
	}

	return stored.token;
}
