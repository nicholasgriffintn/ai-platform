import type {
	RecipeComposioTrigger,
	RecipeComposioTriggerCreateRequest,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { getConnectorProviderConfig } from "~/lib/providers/capabilities/connectors";
import {
	getComposioUserId,
	listComposioConnectedAccounts,
} from "~/lib/providers/capabilities/connectors/composio/client";
import type { RecipeComposioTriggerRecord } from "~/repositories/RecipeComposioTriggerRepository";
import {
	deleteComposioTriggerInstance,
	getComposioTriggerType,
	listComposioTriggerTypes,
	setComposioTriggerEnabled,
	upsertComposioTriggerInstance,
} from "~/services/apps/connectors/composio-trigger-client";
import { requireProjectAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";
import { parseJsonRecord } from "~/utils/json";

import { getRecipeById } from ".";

const MAX_TRIGGER_CONFIGURATION_BYTES = 32_000;

export async function listRecipeComposioTriggerTypes(params: {
	context: ServiceContext;
	userId: number;
	installationId: string;
	providerId: RecipeComposioTrigger["providerId"];
}) {
	const { recipe } = await requireOwnedRecipeInstallation(params);
	if (!recipe.integrations.some((integration) => integration.providerId === params.providerId)) {
		throw new AssistantError(
			"Trigger provider is not part of this recipe",
			ErrorType.PARAMS_ERROR,
			400,
		);
	}
	const provider = getConnectorProviderConfig(params.providerId);
	if (!provider || provider.auth.authType !== "composio") {
		throw new AssistantError(
			"Provider does not support Composio triggers",
			ErrorType.PARAMS_ERROR,
			400,
		);
	}
	return {
		triggerTypes: await listComposioTriggerTypes({
			env: params.context.env,
			toolkitSlug: provider.auth.toolkitSlug,
		}),
	};
}

function toTrigger(record: RecipeComposioTriggerRecord): RecipeComposioTrigger {
	return {
		id: record.id,
		installationId: record.installation_id,
		projectId: record.project_id,
		providerId: record.provider_id as RecipeComposioTrigger["providerId"],
		triggerSlug: record.trigger_slug,
		externalTriggerId: record.external_trigger_id,
		connectedAccountId: record.connected_account_id,
		configuration: record.configuration,
		status: record.status,
		lastError: record.last_error,
		createdAt: record.created_at,
		updatedAt: record.updated_at,
	};
}

async function requireOwnedRecipeInstallation(params: {
	context: ServiceContext;
	userId: number;
	installationId: string;
}) {
	params.context.ensureDatabase();
	const record = await params.context.repositories.templates.getTemplateById(params.installationId);
	if (
		!record ||
		record.kind !== "recipe" ||
		record.created_by_user_id !== params.userId ||
		record.status === "archived"
	) {
		throw new AssistantError("Recipe installation not found", ErrorType.NOT_FOUND, 404);
	}
	if (record.project_id) {
		await requireProjectAccess(params.context, record.project_id);
	}
	const stored = parseJsonRecord(record.configuration);
	const recipeId = typeof stored.recipeId === "string" ? stored.recipeId : record.capability_id;
	const recipe = recipeId ? getRecipeById(recipeId) : undefined;
	if (!recipe || !recipeId) {
		throw new AssistantError("Recipe installation is invalid", ErrorType.PARAMS_ERROR, 400);
	}
	return { record, recipe, recipeId };
}

export async function createRecipeComposioTrigger(params: {
	context: ServiceContext;
	userId: number;
	installationId: string;
	input: RecipeComposioTriggerCreateRequest;
}): Promise<RecipeComposioTrigger> {
	const { record, recipe } = await requireOwnedRecipeInstallation(params);
	if (record.status !== "active") {
		throw new AssistantError(
			"Paused recipes cannot add event triggers",
			ErrorType.PARAMS_ERROR,
			400,
		);
	}
	if (
		!recipe.integrations.some((integration) => integration.providerId === params.input.providerId)
	) {
		throw new AssistantError(
			"Trigger provider is not part of this recipe",
			ErrorType.PARAMS_ERROR,
			400,
		);
	}
	const provider = getConnectorProviderConfig(params.input.providerId);
	if (!provider || provider.auth.authType !== "composio") {
		throw new AssistantError(
			"Provider does not support Composio triggers",
			ErrorType.PARAMS_ERROR,
			400,
		);
	}
	const auth = provider.auth;
	if (JSON.stringify(params.input.configuration).length > MAX_TRIGGER_CONFIGURATION_BYTES) {
		throw new AssistantError("Trigger configuration is too large", ErrorType.PARAMS_ERROR, 400);
	}

	const [triggerType, accounts] = await Promise.all([
		getComposioTriggerType({
			env: params.context.env,
			triggerSlug: params.input.triggerSlug,
		}),
		listComposioConnectedAccounts({
			env: params.context.env,
			userId: params.userId,
			toolkitSlugs: [auth.toolkitSlug],
			authConfigIds: auth.authConfigs.map((config) => config.id),
		}),
	]);
	if (triggerType.toolkitSlug !== auth.toolkitSlug.toLowerCase()) {
		throw new AssistantError(
			"Trigger type does not belong to the selected provider",
			ErrorType.PARAMS_ERROR,
			400,
		);
	}
	const account = accounts.find(
		(candidate) =>
			candidate.id === params.input.connectedAccountId &&
			candidate.toolkitSlug === auth.toolkitSlug &&
			candidate.status === "ACTIVE" &&
			!candidate.isDisabled,
	);
	if (!account) {
		throw new AssistantError("Connected account not found", ErrorType.NOT_FOUND, 404);
	}

	const externalUserId = getComposioUserId(params.context.env, params.userId);
	const remote = await upsertComposioTriggerInstance({
		env: params.context.env,
		triggerSlug: params.input.triggerSlug,
		externalUserId,
		connectedAccountId: account.id,
		configuration: params.input.configuration,
	});
	try {
		return toTrigger(
			await params.context.repositories.recipeComposioTriggers.createTrigger({
				installationId: record.id,
				createdByUserId: params.userId,
				projectId: record.project_id,
				providerId: params.input.providerId,
				triggerSlug: params.input.triggerSlug,
				externalTriggerId: remote.triggerId,
				connectedAccountId: account.id,
				externalUserId,
				configuration: params.input.configuration,
			}),
		);
	} catch (error) {
		const existing =
			await params.context.repositories.recipeComposioTriggers.getTriggerByExternalId(
				remote.triggerId,
			);
		if (existing?.created_by_user_id === params.userId && existing.installation_id === record.id) {
			return toTrigger(existing);
		}
		await deleteComposioTriggerInstance({
			env: params.context.env,
			triggerId: remote.triggerId,
		}).catch(() => undefined);
		throw error;
	}
}

export async function listRecipeComposioTriggers(params: {
	context: ServiceContext;
	userId: number;
	installationId: string;
}): Promise<{ triggers: RecipeComposioTrigger[] }> {
	await requireOwnedRecipeInstallation(params);
	const records = await params.context.repositories.recipeComposioTriggers.listInstallationTriggers(
		params.installationId,
		params.userId,
	);
	return { triggers: records.map(toTrigger) };
}

export async function setRecipeComposioTriggerStatus(params: {
	context: ServiceContext;
	userId: number;
	triggerId: string;
	status: "active" | "paused";
}): Promise<RecipeComposioTrigger | null> {
	const trigger = await params.context.repositories.recipeComposioTriggers.getTriggerForOwner(
		params.triggerId,
		params.userId,
	);
	if (!trigger) return null;
	await requireOwnedRecipeInstallation({
		context: params.context,
		userId: params.userId,
		installationId: trigger.installation_id,
	});
	await setComposioTriggerEnabled({
		env: params.context.env,
		triggerId: trigger.external_trigger_id,
		enabled: params.status === "active",
	});
	const updated = await params.context.repositories.recipeComposioTriggers.updateStatus(
		trigger.id,
		params.userId,
		params.status,
	);
	return updated ? toTrigger(updated) : null;
}

export async function deleteRecipeComposioTrigger(params: {
	context: ServiceContext;
	userId: number;
	triggerId: string;
}): Promise<boolean> {
	const trigger = await params.context.repositories.recipeComposioTriggers.getTriggerForOwner(
		params.triggerId,
		params.userId,
	);
	if (!trigger) return false;
	await requireOwnedRecipeInstallation({
		context: params.context,
		userId: params.userId,
		installationId: trigger.installation_id,
	});
	await deleteComposioTriggerInstance({
		env: params.context.env,
		triggerId: trigger.external_trigger_id,
	});
	return params.context.repositories.recipeComposioTriggers.deleteTrigger(
		trigger.id,
		params.userId,
	);
}
