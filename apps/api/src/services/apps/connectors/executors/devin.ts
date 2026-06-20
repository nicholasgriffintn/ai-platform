import { AssistantError, ErrorType } from "~/utils/errors";
import { fetchConnectorJson } from "./http";
import { getNumberParam, getStringParam, limitPositiveInteger } from "./params";

const DEVIN_API_BASE_URL = "https://api.devin.ai/v3";

function requireOrganizationId(params: Record<string, unknown>): string {
	const organizationId =
		getStringParam(params, "organizationId") ?? getStringParam(params, "orgId");
	if (!organizationId) {
		throw new AssistantError("organizationId is required", ErrorType.PARAMS_ERROR, 400);
	}
	return organizationId;
}

function requireSessionId(params: Record<string, unknown>): string {
	const sessionId = getStringParam(params, "sessionId") ?? getStringParam(params, "devinId");
	if (!sessionId) {
		throw new AssistantError("sessionId is required", ErrorType.PARAMS_ERROR, 400);
	}
	return sessionId;
}

function addDevinPagination(url: URL, params: Record<string, unknown>) {
	const after = getStringParam(params, "after");
	if (after) {
		url.searchParams.set("after", after);
	}
	url.searchParams.set(
		"first",
		limitPositiveInteger(getNumberParam(params, "first"), 20, 100).toString(),
	);
}

function addStringListParam(url: URL, params: Record<string, unknown>, key: string) {
	const value = params[key];
	if (Array.isArray(value)) {
		for (const item of value) {
			if (typeof item === "string" && item.trim()) {
				url.searchParams.append(key, item.trim());
			}
		}
	}
}

function addSessionFilters(url: URL, params: Record<string, unknown>) {
	for (const key of [
		"createdAfter",
		"createdBefore",
		"updatedAfter",
		"updatedBefore",
		"playbookId",
		"scheduleId",
		"category",
	]) {
		const value = getStringParam(params, key);
		if (value) {
			url.searchParams.set(
				key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
				value,
			);
		}
	}

	for (const key of [
		"session_ids",
		"tags",
		"origins",
		"user_ids",
		"service_user_ids",
		"repo_names",
	]) {
		addStringListParam(url, params, key);
	}

	if (typeof params.isArchived === "boolean") {
		url.searchParams.set("is_archived", params.isArchived ? "true" : "false");
	}
}

function buildSessionCreateBody(params: Record<string, unknown>): Record<string, unknown> {
	const prompt = getStringParam(params, "prompt");
	if (!prompt) {
		throw new AssistantError("prompt is required", ErrorType.PARAMS_ERROR, 400);
	}

	const body: Record<string, unknown> = { prompt };
	for (const key of [
		"title",
		"playbookId",
		"createAsUserId",
		"childPlaybookId",
		"platform",
		"devinMode",
	]) {
		const value = getStringParam(params, key);
		if (value) {
			body[key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)] = value;
		}
	}

	for (const key of [
		"tags",
		"knowledge_ids",
		"secret_ids",
		"repos",
		"attachment_urls",
		"session_links",
	]) {
		const value = params[key];
		if (Array.isArray(value)) {
			body[key] = value.filter(
				(item): item is string => typeof item === "string" && Boolean(item.trim()),
			);
		}
	}

	const maxAcuLimit = getNumberParam(params, "maxAcuLimit");
	if (maxAcuLimit !== undefined) {
		body.max_acu_limit = Math.max(Math.floor(maxAcuLimit), 1);
	}

	if (typeof params.structuredOutputRequired === "boolean") {
		body.structured_output_required = params.structuredOutputRequired;
	}

	return body;
}

export async function executeDevinOperation(
	token: string,
	operation: string,
	params: Record<string, unknown>,
) {
	const organizationId = requireOrganizationId(params);

	if (operation === "list_sessions") {
		const url = new URL(
			`${DEVIN_API_BASE_URL}/organizations/${encodeURIComponent(organizationId)}/sessions`,
		);
		addDevinPagination(url, params);
		addSessionFilters(url, params);
		return fetchConnectorJson({ url: url.toString(), token });
	}

	if (operation === "get_session") {
		const sessionId = requireSessionId(params);
		return fetchConnectorJson({
			url: `${DEVIN_API_BASE_URL}/organizations/${encodeURIComponent(
				organizationId,
			)}/sessions/${encodeURIComponent(sessionId)}`,
			token,
		});
	}

	if (operation === "create_session") {
		return fetchConnectorJson({
			url: `${DEVIN_API_BASE_URL}/organizations/${encodeURIComponent(organizationId)}/sessions`,
			token,
			method: "POST",
			body: buildSessionCreateBody(params),
		});
	}

	if (operation === "list_messages") {
		const sessionId = requireSessionId(params);
		const url = new URL(
			`${DEVIN_API_BASE_URL}/organizations/${encodeURIComponent(
				organizationId,
			)}/sessions/${encodeURIComponent(sessionId)}/messages`,
		);
		addDevinPagination(url, params);
		return fetchConnectorJson({ url: url.toString(), token });
	}

	if (operation === "send_message") {
		const sessionId = requireSessionId(params);
		const message = getStringParam(params, "message");
		if (!message) {
			throw new AssistantError("message is required", ErrorType.PARAMS_ERROR, 400);
		}
		return fetchConnectorJson({
			url: `${DEVIN_API_BASE_URL}/organizations/${encodeURIComponent(
				organizationId,
			)}/sessions/${encodeURIComponent(sessionId)}/messages`,
			token,
			method: "POST",
			body: { message },
		});
	}

	throw new AssistantError("Unsupported Devin operation", ErrorType.PARAMS_ERROR, 400);
}
