import { recipeChatRequestOptionsSchema } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ConnectorOperationApprovalRecord } from "~/repositories/ConnectorOperationApprovalRepository";
import type { ComposioConnectorSessionRecord } from "~/repositories/ComposioConnectorSessionRepository";
import {
	buildRecipeConnections,
	buildRecipeInvocationRuntime,
} from "~/services/apps/recipes/runtime";
import { getRecipeById, parseRecipeInstallationRecord } from "~/services/apps/recipes";
import { requireProjectAccess } from "~/services/workspaces/access";

import type {
	ConnectorApprovalExecutionAuthority,
	ResolveConnectorApprovalAuthority,
	StoredConnectorOperationCall,
} from "./connector-approval-authority";

function failAuthority(): never {
	throw new Error("Connector approval authority does not match the stored action");
}

function requireSessionMatchesApproval(params: {
	approval: ConnectorOperationApprovalRecord;
	call: StoredConnectorOperationCall;
	userId: number;
	session: ComposioConnectorSessionRecord | null;
}): ComposioConnectorSessionRecord {
	const { approval, session, call, userId } = params;
	if (
		!session ||
		session.id !== call.sessionId ||
		session.kind !== "tool" ||
		session.userId !== userId ||
		session.provider !== approval.provider ||
		session.runId !== approval.runId ||
		session.completionId !== approval.completionId ||
		session.connectedAccountId !== approval.connectedAccountId ||
		!session.allowedOperationIds.includes(approval.operation) ||
		!session.authConfigId ||
		!session.connectedAccountId ||
		(session.state !== "active" && session.state !== "claimed") ||
		session.expiresAt <= new Date().toISOString()
	) {
		failAuthority();
	}
	return session;
}

async function buildRecipeContext(params: {
	context: ServiceContext;
	session: ComposioConnectorSessionRecord;
	userId: number;
	channel: string;
}): Promise<{
	requestOptions: ConnectorApprovalExecutionAuthority["requestOptions"];
	projectId?: string;
}> {
	if (!params.session.recipeId) {
		if (params.channel !== "web") failAuthority();
		return { requestOptions: {} };
	}

	const recipe = getRecipeById(params.session.recipeId);
	if (!recipe) failAuthority();
	let installation = null;
	if (params.session.installationId) {
		const record = await params.context.repositories.templates.getTemplateById(
			params.session.installationId,
		);
		installation = record ? parseRecipeInstallationRecord(record) : null;
		if (
			!installation ||
			installation.userId !== params.userId ||
			installation.recipeId !== recipe.id ||
			installation.id !== params.session.installationId
		) {
			failAuthority();
		}
		if (installation.projectId) {
			await requireProjectAccess(params.context, installation.projectId);
		}
	}

	const runtime = buildRecipeInvocationRuntime({
		recipe,
		connections: buildRecipeConnections(recipe),
		installation,
		configuration: installation?.configuration,
	});
	const channel = recipeChatRequestOptionsSchema.shape.channel.safeParse(params.channel);
	if (!channel.success || channel.data === undefined) failAuthority();

	return {
		requestOptions: {
			recipe: {
				id: recipe.id,
				...(installation ? { installationId: installation.id } : {}),
				channel: channel.data,
				allowedConnectorProviders: runtime.allowedConnectorProviders,
				allowedConnectorOperations: runtime.allowedConnectorOperations,
				...(installation?.configuration ? { configuration: installation.configuration } : {}),
			},
		},
		...(installation?.projectId ? { projectId: installation.projectId } : {}),
	};
}

export const resolveComposioApprovalAuthority: ResolveConnectorApprovalAuthority = async (
	params,
) => {
	const session = requireSessionMatchesApproval({
		approval: params.approval,
		call: params.call,
		userId: params.userId,
		session: await params.context.repositories.composioConnectorSessions.getById(
			params.call.sessionId,
		),
	});
	const recipeContext = await buildRecipeContext({
		context: params.context,
		session,
		userId: params.userId,
		channel: params.approval.channel,
	});

	return {
		...recipeContext,
		arguments: {
			...recipeContext.requestOptions.recipe?.configuration,
			...params.call.params,
		},
	};
};
