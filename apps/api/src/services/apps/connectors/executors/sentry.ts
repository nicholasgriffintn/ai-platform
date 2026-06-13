import { AssistantError, ErrorType } from "~/utils/errors";
import { coerceStringArray } from "~/utils/objects";
import { fetchConnectorJson } from "./http";
import { getNumberParam, getStringParam, limitPositiveInteger } from "./params";

const SENTRY_API_BASE_URL = "https://sentry.io/api/0";

function requireOrganizationSlug(params: Record<string, unknown>): string {
	const organizationSlug =
		getStringParam(params, "organizationSlug") ?? getStringParam(params, "organization");
	if (!organizationSlug) {
		throw new AssistantError("organizationSlug is required", ErrorType.PARAMS_ERROR, 400);
	}

	return organizationSlug;
}

function addProjectFilters(url: URL, params: Record<string, unknown>) {
	const projectIds = coerceStringArray(params.projectIds)
		.map((projectId) => projectId.trim())
		.filter(Boolean)
		.slice(0, 20);
	const projectId = getStringParam(params, "projectId");

	for (const value of projectIds.length > 0 ? projectIds : projectId ? [projectId] : []) {
		url.searchParams.append("project", value);
	}
}

export async function executeSentryOperation(
	token: string,
	operation: string,
	params: Record<string, unknown>,
) {
	if (operation === "list_organizations") {
		return fetchConnectorJson({
			url: `${SENTRY_API_BASE_URL}/organizations/`,
			token,
		});
	}

	if (operation === "list_projects") {
		const organizationSlug = requireOrganizationSlug(params);
		const url = new URL(
			`${SENTRY_API_BASE_URL}/organizations/${encodeURIComponent(organizationSlug)}/projects/`,
		);
		const query = getStringParam(params, "query");
		if (query) {
			url.searchParams.set("query", query);
		}
		url.searchParams.set(
			"per_page",
			String(limitPositiveInteger(getNumberParam(params, "limit"), 25, 100)),
		);

		return fetchConnectorJson({ url: url.toString(), token });
	}

	if (operation === "list_issues") {
		const organizationSlug = requireOrganizationSlug(params);
		const url = new URL(
			`${SENTRY_API_BASE_URL}/organizations/${encodeURIComponent(organizationSlug)}/issues/`,
		);
		url.searchParams.set("query", getStringParam(params, "query") ?? "is:unresolved");
		url.searchParams.set("statsPeriod", getStringParam(params, "statsPeriod") ?? "24h");
		url.searchParams.set("sort", getStringParam(params, "sort") ?? "date");
		url.searchParams.set(
			"limit",
			String(limitPositiveInteger(getNumberParam(params, "limit"), 25, 100)),
		);
		addProjectFilters(url, params);

		return fetchConnectorJson({ url: url.toString(), token });
	}

	if (operation === "retrieve_issue") {
		const issueId = getStringParam(params, "issueId");
		if (!issueId) {
			throw new AssistantError("issueId is required", ErrorType.PARAMS_ERROR, 400);
		}

		return fetchConnectorJson({
			url: `${SENTRY_API_BASE_URL}/issues/${encodeURIComponent(issueId)}/`,
			token,
		});
	}

	throw new AssistantError("Unsupported Sentry operation", ErrorType.PARAMS_ERROR, 400);
}
