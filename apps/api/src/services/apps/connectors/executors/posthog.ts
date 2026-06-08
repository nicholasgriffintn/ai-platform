import { AssistantError, ErrorType } from "~/utils/errors";
import { fetchConnectorJson } from "./http";
import { getNumberParam, getStringParam, limitPositiveInteger } from "./params";

const POSTHOG_HOSTS = {
	us: "https://us.posthog.com",
	eu: "https://eu.posthog.com",
	app: "https://app.posthog.com",
} as const;

const HOGQL_WRITE_PATTERN =
	/\b(alter|attach|create|delete|detach|drop|grant|insert|kill|optimize|rename|replace|revoke|truncate|update)\b/i;

function getPostHogBaseUrl(params: Record<string, unknown>): string {
	const region = getStringParam(params, "region");
	if (!region) {
		return POSTHOG_HOSTS.us;
	}

	if (region === "us" || region === "eu" || region === "app") {
		return POSTHOG_HOSTS[region];
	}

	throw new AssistantError("region must be us, eu, or app", ErrorType.PARAMS_ERROR, 400);
}

function requirePostHogProjectId(params: Record<string, unknown>): string {
	const projectId = getStringParam(params, "projectId");
	if (!projectId) {
		throw new AssistantError("projectId is required", ErrorType.PARAMS_ERROR, 400);
	}

	return projectId;
}

function requirePostHogOrganizationId(params: Record<string, unknown>): string {
	const organizationId = getStringParam(params, "organizationId");
	if (!organizationId) {
		throw new AssistantError("organizationId is required", ErrorType.PARAMS_ERROR, 400);
	}

	return organizationId;
}

function buildHogQlQuery(params: Record<string, unknown>) {
	const query = getStringParam(params, "query");
	if (!query) {
		throw new AssistantError("query is required", ErrorType.PARAMS_ERROR, 400);
	}
	if (HOGQL_WRITE_PATTERN.test(query)) {
		throw new AssistantError("query must be read-only", ErrorType.PARAMS_ERROR, 400);
	}

	return {
		query: {
			kind: "HogQLQuery",
			query,
		},
		limit: limitPositiveInteger(getNumberParam(params, "limit"), 100, 500),
	};
}

export async function executePostHogOperation(
	token: string,
	operation: string,
	params: Record<string, unknown>,
) {
	const baseUrl = getPostHogBaseUrl(params);

	if (operation === "list_projects") {
		const organizationId = requirePostHogOrganizationId(params);
		const url = new URL(
			`${baseUrl}/api/organizations/${encodeURIComponent(organizationId)}/projects/`,
		);
		const search = getStringParam(params, "search");
		if (search) {
			url.searchParams.set("search", search);
		}
		url.searchParams.set(
			"limit",
			String(limitPositiveInteger(getNumberParam(params, "limit"), 25, 100)),
		);

		return fetchConnectorJson({ url: url.toString(), token });
	}

	if (operation === "query") {
		const projectId = requirePostHogProjectId(params);
		return fetchConnectorJson({
			url: `${baseUrl}/api/projects/${encodeURIComponent(projectId)}/query/`,
			token,
			method: "POST",
			body: buildHogQlQuery(params),
		});
	}

	throw new AssistantError("Unsupported PostHog operation", ErrorType.PARAMS_ERROR, 400);
}
