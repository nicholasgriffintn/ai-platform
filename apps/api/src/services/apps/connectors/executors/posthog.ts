import { AssistantError, ErrorType } from "~/utils/errors";
import { isRecord } from "~/utils/objects";
import { fetchConnectorJson } from "./http";
import { getNumberParam, getStringParam, limitPositiveInteger } from "./params";

const POSTHOG_HOSTS = {
	us: "https://us.posthog.com",
	eu: "https://eu.posthog.com",
	app: "https://app.posthog.com",
} as const;

const HOGQL_WRITE_PATTERN =
	/\b(alter|attach|create|delete|detach|drop|grant|insert|kill|optimize|rename|replace|revoke|truncate|update)\b/i;
const HOGQL_LIMIT_PATTERN = /\blimit\s+(\d+)\b/i;
const DEFAULT_HOGQL_LIMIT = 100;
const MAX_HOGQL_LIMIT = 500;

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

function getHogQlQueryText(params: Record<string, unknown>): string | undefined {
	const query = getStringParam(params, "query");
	if (query) {
		return query;
	}

	const queryObject = params.query;
	if (!isRecord(queryObject)) {
		return undefined;
	}

	const kind = getStringParam(queryObject, "kind");
	if (kind && kind !== "HogQLQuery") {
		throw new AssistantError("query.kind must be HogQLQuery", ErrorType.PARAMS_ERROR, 400);
	}

	return getStringParam(queryObject, "query");
}

function boundHogQlQuery(query: string, params: Record<string, unknown>): string {
	const fallbackLimit = limitPositiveInteger(
		getNumberParam(params, "limit"),
		DEFAULT_HOGQL_LIMIT,
		MAX_HOGQL_LIMIT,
	);
	const trimmedQuery = query.trim().replace(/;+\s*$/, "");
	const inlineLimit = HOGQL_LIMIT_PATTERN.exec(trimmedQuery);
	if (!inlineLimit) {
		return `${trimmedQuery} LIMIT ${fallbackLimit}`;
	}

	const requestedLimit = Number(inlineLimit[1]);
	if (Number.isFinite(requestedLimit) && requestedLimit > MAX_HOGQL_LIMIT) {
		return trimmedQuery.replace(HOGQL_LIMIT_PATTERN, `LIMIT ${MAX_HOGQL_LIMIT}`);
	}

	return trimmedQuery;
}

function buildHogQlQuery(params: Record<string, unknown>) {
	const query = getHogQlQueryText(params);
	if (!query) {
		throw new AssistantError("query is required", ErrorType.PARAMS_ERROR, 400);
	}
	if (HOGQL_WRITE_PATTERN.test(query)) {
		throw new AssistantError("query must be read-only", ErrorType.PARAMS_ERROR, 400);
	}

	return {
		query: {
			kind: "HogQLQuery",
			query: boundHogQlQuery(query, params),
		},
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
