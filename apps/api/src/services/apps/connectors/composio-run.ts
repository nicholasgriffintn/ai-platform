import type { RecipeConnectorProvider } from "@assistant/schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ConnectorProviderConfig } from "~/lib/providers/capabilities/connectors";
import {
	createComposioToolSession,
	deleteComposioToolSession,
	executeComposioSessionTool,
	listComposioConnectedAccounts,
	searchComposioSessionTools,
	type ComposioConnectedAccount,
} from "~/lib/providers/capabilities/connectors/composio/client";
import type { ComposioConnectorSessionRecord } from "~/repositories/ComposioConnectorSessionRepository";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getSelectedRecipeConnectorAccountId } from "./accounts";
import { getLogger } from "~/utils/logger";
import { isRecord } from "~/utils/objects";
import {
	assertComposioFileBridgeAvailable,
	createComposioMountFileClient,
	importComposioOperationFileResults,
	resolveComposioFileReferences,
} from "./composio-files";
import type { ConnectorRunScope } from "./connector-run-scope";

const TOOL_SESSION_TTL_MS = 30 * 60 * 1000;
const CLEANUP_RETRY_DELAY_MS = 60 * 1000;
const RUN_SESSION_CACHE_KEY = "composio:connector-run:sessions";
const logger = getLogger({ prefix: "services/apps/connectors/composio-run" });

function findTrackedSessions(
	context: ServiceContext,
): Map<string, ComposioConnectorSessionRecord> | undefined {
	if (!context.requestCache) return undefined;

	const existing = context.requestCache.get(RUN_SESSION_CACHE_KEY);
	if (existing instanceof Map) {
		return existing as Map<string, ComposioConnectorSessionRecord>;
	}
	return undefined;
}

function getTrackedSessions(context: ServiceContext): Map<string, ComposioConnectorSessionRecord> {
	const existing = findTrackedSessions(context);
	if (existing) return existing;

	const sessions = new Map<string, ComposioConnectorSessionRecord>();
	context.requestCache.set(RUN_SESSION_CACHE_KEY, sessions);
	return sessions;
}

function trackSession(context: ServiceContext, session: ComposioConnectorSessionRecord): void {
	getTrackedSessions(context).set(session.id, session);
}

async function persistToolSession(params: {
	context: ServiceContext;
	userId: number;
	provider: ConnectorProviderConfig;
	connectedAccount: ComposioConnectedAccount;
	remoteSessionId: string;
	allowedOperationIds: readonly string[];
	scope: ConnectorRunScope;
}): Promise<ComposioConnectorSessionRecord> {
	if (params.provider.auth.authType !== "composio" || !params.connectedAccount.authConfigId) {
		throw new AssistantError(
			"Connector session scope is invalid",
			ErrorType.AUTHORISATION_ERROR,
			403,
		);
	}
	const now = Date.now();
	const session = await params.context.repositories.composioConnectorSessions.create({
		remoteSessionId: params.remoteSessionId,
		kind: "tool",
		userId: params.userId,
		provider: params.provider.id,
		toolkitSlug: params.provider.auth.toolkitSlug,
		authConfigId: params.connectedAccount.authConfigId,
		connectedAccountId: params.connectedAccount.id,
		allowedOperationIds: params.allowedOperationIds,
		runId: params.context.connectorRunId,
		completionId: params.scope.completionId,
		recipeId: params.scope.recipeId,
		installationId: params.scope.installationId,
		createdAt: new Date(now).toISOString(),
		expiresAt: new Date(now + TOOL_SESSION_TTL_MS).toISOString(),
	});
	trackSession(params.context, session);
	return session;
}

async function deleteUnpersistedSession(context: ServiceContext, remoteSessionId: string) {
	await deleteComposioToolSession({ env: context.env, sessionId: remoteSessionId }).catch(
		() => undefined,
	);
}

export async function discoverComposioRunTools(params: {
	context: ServiceContext;
	userId: number;
	provider: ConnectorProviderConfig;
	connectedAccount: ComposioConnectedAccount;
	allowedOperationIds: string[];
	useCase: string;
	scope: ConnectorRunScope;
}) {
	const remoteSessionId = await createComposioToolSession({
		env: params.context.env,
		userId: params.userId,
		provider: params.provider,
		connectedAccount: params.connectedAccount,
		allowedToolSlugs: params.allowedOperationIds,
	});
	try {
		const discovery = await searchComposioSessionTools({
			env: params.context.env,
			sessionId: remoteSessionId,
			provider: params.provider,
			useCase: params.useCase,
		});
		for (const tool of discovery.tools) {
			assertComposioFileBridgeAvailable({
				bridgeAvailable: Boolean(
					params.context.env.PRIVATE_ASSETS_BUCKET && params.context.env.COMPOSIO_API_KEY?.trim(),
				),
				inputSchema: tool.inputSchema,
			});
		}
		const session = await persistToolSession({
			...params,
			remoteSessionId,
			allowedOperationIds: params.allowedOperationIds,
		});
		return { ...discovery, sessionId: session.id };
	} catch (error) {
		await deleteUnpersistedSession(params.context, remoteSessionId);
		throw error;
	}
}

async function claimSession(params: {
	context: ServiceContext;
	userId: number;
	provider: RecipeConnectorProvider;
	operationId: string;
	sessionId: string;
	scope: ConnectorRunScope;
}): Promise<ComposioConnectorSessionRecord> {
	const claimedAt = new Date().toISOString();
	const session = await params.context.repositories.composioConnectorSessions.claimForExecution({
		id: params.sessionId,
		userId: params.userId,
		provider: params.provider,
		operationId: params.operationId,
		runId: params.context.connectorRunId,
		completionId: params.scope.completionId,
		recipeId: params.scope.recipeId,
		installationId: params.scope.installationId,
		claimedAt,
	});
	if (!session?.authConfigId || !session.connectedAccountId) {
		throw new AssistantError("Connector session is invalid or expired", ErrorType.FORBIDDEN, 403);
	}
	trackSession(params.context, session);
	return session;
}

export async function executeComposioRunTool(params: {
	context: ServiceContext;
	userId: number;
	provider: ConnectorProviderConfig;
	connectedAccount?: ComposioConnectedAccount;
	operationId: string;
	arguments: Record<string, unknown>;
	sessionId?: string;
	scope: ConnectorRunScope;
}) {
	let handle = params.sessionId;
	if (!handle) {
		if (!params.connectedAccount) {
			throw new AssistantError("Connector account is required", ErrorType.AUTHORISATION_ERROR, 403);
		}
		const remoteSessionId = await createComposioToolSession({
			env: params.context.env,
			userId: params.userId,
			provider: params.provider,
			connectedAccount: params.connectedAccount,
			allowedToolSlugs: [params.operationId],
		});
		try {
			const persisted = await persistToolSession({
				context: params.context,
				userId: params.userId,
				provider: params.provider,
				connectedAccount: params.connectedAccount,
				remoteSessionId,
				allowedOperationIds: [params.operationId],
				scope: params.scope,
			});
			handle = persisted.id;
		} catch (error) {
			await deleteUnpersistedSession(params.context, remoteSessionId);
			throw error;
		}
	}

	const session = await claimSession({
		context: params.context,
		userId: params.userId,
		provider: params.provider.id,
		operationId: params.operationId,
		sessionId: handle,
		scope: params.scope,
	});
	const accounts = await listComposioConnectedAccounts({
		env: params.context.env,
		userId: params.userId,
		toolkitSlugs: [session.toolkitSlug],
		authConfigIds: [session.authConfigId!],
		connectedAccountIds: [session.connectedAccountId!],
	});
	if (!accounts.some((account) => account.status === "ACTIVE" && !account.isDisabled)) {
		throw new AssistantError("Connector is not connected", ErrorType.AUTHORISATION_ERROR, 403);
	}
	let logId: string | undefined;
	try {
		const resolvedArguments = await resolveComposioFileReferences({
			context: params.context,
			userId: params.userId,
			client: createComposioMountFileClient(params.context.env),
			sessionId: session.remoteSessionId,
			value: params.arguments,
			conversationId: params.scope.completionId,
			projectId: params.scope.projectId,
		});
		if (!isRecord(resolvedArguments)) {
			throw new AssistantError("Connector arguments are invalid", ErrorType.PARAMS_ERROR, 400);
		}
		const result = await executeComposioSessionTool({
			env: params.context.env,
			userId: params.userId,
			sessionId: session.remoteSessionId,
			provider: params.provider,
			toolSlug: params.operationId,
			authConfigId: session.authConfigId!,
			connectedAccountId: session.connectedAccountId!,
			arguments: resolvedArguments,
		});
		const data = await importComposioOperationFileResults({
			context: params.context,
			userId: params.userId,
			client: createComposioMountFileClient(params.context.env),
			sessionId: session.remoteSessionId,
			value: result.data,
			conversationId: params.scope.completionId,
			projectId: params.scope.projectId,
		});
		logId = result.logId;
		await recordConnectorActivity({ ...params, session, status: "succeeded", logId });
		return {
			data,
			logId,
			sessionHandle: session.id,
			runId: session.runId,
		};
	} catch (error) {
		if (error instanceof AssistantError && typeof error.context?.requestId === "string") {
			logId = error.context.requestId;
		}
		await recordConnectorActivity({ ...params, session, status: "failed", logId });
		throw error;
	}
}

async function recordConnectorActivity(params: {
	context: ServiceContext;
	userId: number;
	provider: ConnectorProviderConfig;
	operationId: string;
	scope: ConnectorRunScope;
	session: ComposioConnectorSessionRecord;
	status: "succeeded" | "failed";
	logId?: string;
}): Promise<void> {
	try {
		await params.context.repositories.activities.createActivity({
			createdByUserId: params.userId,
			projectId: params.scope.projectId ?? null,
			conversationId: params.scope.completionId,
			capabilityId: `connector:${params.provider.id}`,
			groupId: params.context.connectorRunId,
			kind: "connector_operation",
			status: params.status,
			summary: `${params.provider.name} ${params.operationId} ${params.status}`,
			data: {
				provider: params.provider.id,
				operation: params.operationId,
				selectedAccountId: params.session.connectedAccountId,
				sessionHandle: params.session.id,
				connectorRunId: params.context.connectorRunId,
				completionId: params.scope.completionId,
				recipeId: params.scope.recipeId,
				installationId: params.scope.installationId,
				...(params.logId ? { composioLogId: params.logId } : {}),
			},
		});
	} catch (error) {
		logger.warn("Could not persist connector operation activity", {
			provider: params.provider.id,
			operation: params.operationId,
			connectorRunId: params.context.connectorRunId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

export async function resolveComposioRunAccount(params: {
	context: ServiceContext;
	userId: number;
	provider: ConnectorProviderConfig;
	operationId: string;
	sessionId?: string;
	scope: ConnectorRunScope;
}): Promise<{
	connectedAccount: ComposioConnectedAccount;
	session?: ComposioConnectorSessionRecord;
}> {
	if (!params.sessionId) {
		if (params.provider.auth.authType !== "composio") {
			throw new AssistantError("Connector is not managed by Composio", ErrorType.PARAMS_ERROR, 400);
		}
		const accounts = await listComposioConnectedAccounts({
			env: params.context.env,
			userId: params.userId,
			toolkitSlugs: [params.provider.auth.toolkitSlug],
			authConfigIds: params.provider.auth.authConfigs.map((config) => config.id),
		});
		const active = accounts.filter((account) => account.status === "ACTIVE" && !account.isDisabled);
		if (active.length === 0) {
			throw new AssistantError("Connector is not connected", ErrorType.AUTHORISATION_ERROR, 403);
		}
		const selectedAccountId = await getSelectedRecipeConnectorAccountId({
			context: params.context,
			userId: params.userId,
			providerId: params.provider.id,
		});
		return {
			connectedAccount:
				active.find((account) => account.id === selectedAccountId) ??
				active.reduce((selected, account) =>
					account.createdAt > selected.createdAt ? account : selected,
				),
		};
	}

	const session = await claimSession({
		context: params.context,
		userId: params.userId,
		provider: params.provider.id,
		operationId: params.operationId,
		sessionId: params.sessionId,
		scope: params.scope,
	});
	const accounts = await listComposioConnectedAccounts({
		env: params.context.env,
		userId: params.userId,
		toolkitSlugs: [session.toolkitSlug],
		authConfigIds: [session.authConfigId!],
		connectedAccountIds: [session.connectedAccountId!],
	});
	const connectedAccount = accounts.find(
		(account) => account.status === "ACTIVE" && !account.isDisabled,
	);
	if (!connectedAccount) {
		throw new AssistantError("Connector is not connected", ErrorType.AUTHORISATION_ERROR, 403);
	}
	return { connectedAccount, session };
}

export async function closeComposioConnectorRun(context: ServiceContext): Promise<void> {
	const trackedSessions = findTrackedSessions(context);
	if (!trackedSessions?.size) return;

	const sessions = [...trackedSessions.values()];
	for (const session of sessions) {
		try {
			await deleteComposioToolSession({ env: context.env, sessionId: session.remoteSessionId });
			await context.repositories.composioConnectorSessions.delete(session.id);
			trackedSessions.delete(session.id);
		} catch (error) {
			try {
				await context.repositories.composioConnectorSessions.markCleanupPending({
					id: session.id,
					cleanupAfter: new Date(Date.now() + CLEANUP_RETRY_DELAY_MS).toISOString(),
				});
			} catch (persistenceError) {
				logger.warn("Could not persist Composio connector session cleanup retry", {
					sessionHandle: session.id,
					cleanupError: error instanceof Error ? error.message : String(error),
					persistenceError:
						persistenceError instanceof Error ? persistenceError.message : String(persistenceError),
				});
			}
		}
	}
}

export function retainComposioConnectorSession(
	context: ServiceContext,
	sessionHandle: string,
): void {
	getTrackedSessions(context).delete(sessionHandle);
}
