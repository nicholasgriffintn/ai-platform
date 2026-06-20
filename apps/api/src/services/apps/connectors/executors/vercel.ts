import { AssistantError, ErrorType } from "~/utils/errors";
import { coerceStringArray } from "~/utils/objects";
import { fetchConnectorJson } from "./http";
import { getNumberParam, getStringParam, limitPositiveInteger } from "./params";

const VERCEL_API_BASE_URL = "https://api.vercel.com";

function addTeamScope(url: URL, params: Record<string, unknown>) {
	const teamId = getStringParam(params, "teamId");
	const slug = getStringParam(params, "slug");
	if (teamId) {
		url.searchParams.set("teamId", teamId);
	}
	if (slug) {
		url.searchParams.set("slug", slug);
	}
}

function addStringParam(url: URL, params: Record<string, unknown>, key: string, alias?: string) {
	const value = getStringParam(params, key) ?? (alias ? getStringParam(params, alias) : undefined);
	if (value) {
		url.searchParams.set(key, value);
	}
}

function addNumberParam(url: URL, params: Record<string, unknown>, key: string) {
	const value = getNumberParam(params, key);
	if (value !== undefined) {
		url.searchParams.set(key, String(Math.floor(value)));
	}
}

function addProjectIdFilters(url: URL, params: Record<string, unknown>) {
	const projectIds = coerceStringArray(params.projectIds)
		.map((projectId) => projectId.trim())
		.filter(Boolean)
		.slice(0, 20);
	const projectId = getStringParam(params, "projectId");

	if (projectId) {
		url.searchParams.set("projectId", projectId);
		return;
	}

	if (projectIds.length > 0) {
		for (const projectId of projectIds) {
			url.searchParams.append("projectIds", projectId);
		}
	}
}

function requireDeploymentIdOrUrl(params: Record<string, unknown>): string {
	const idOrUrl = getStringParam(params, "idOrUrl") ?? getStringParam(params, "deploymentId");
	if (!idOrUrl) {
		throw new AssistantError("idOrUrl is required", ErrorType.PARAMS_ERROR, 400);
	}

	return idOrUrl;
}

export async function executeVercelOperation(
	token: string,
	operation: string,
	params: Record<string, unknown>,
) {
	if (operation === "list_projects") {
		const url = new URL(`${VERCEL_API_BASE_URL}/v9/projects`);
		addTeamScope(url, params);
		addStringParam(url, params, "repoUrl");
		addStringParam(url, params, "gitForkProtection");
		addStringParam(url, params, "buildMachineTypes");
		url.searchParams.set(
			"limit",
			String(limitPositiveInteger(getNumberParam(params, "limit"), 20, 100)),
		);

		return fetchConnectorJson({ url: url.toString(), token });
	}

	if (operation === "list_deployments") {
		const url = new URL(`${VERCEL_API_BASE_URL}/v6/deployments`);
		addTeamScope(url, params);
		addStringParam(url, params, "app", "projectName");
		addStringParam(url, params, "target");
		addStringParam(url, params, "state");
		addStringParam(url, params, "branch");
		addStringParam(url, params, "sha");
		addStringParam(url, params, "users");
		addNumberParam(url, params, "since");
		addNumberParam(url, params, "until");
		addProjectIdFilters(url, params);
		url.searchParams.set(
			"limit",
			String(limitPositiveInteger(getNumberParam(params, "limit"), 10, 100)),
		);

		return fetchConnectorJson({ url: url.toString(), token });
	}

	if (operation === "get_deployment_events") {
		const idOrUrl = requireDeploymentIdOrUrl(params);
		const url = new URL(
			`${VERCEL_API_BASE_URL}/v3/deployments/${encodeURIComponent(idOrUrl)}/events`,
		);
		addTeamScope(url, params);
		addStringParam(url, params, "direction");
		addStringParam(url, params, "name", "buildId");
		addStringParam(url, params, "statusCode");
		addNumberParam(url, params, "since");
		addNumberParam(url, params, "until");
		url.searchParams.set(
			"limit",
			String(limitPositiveInteger(getNumberParam(params, "limit"), 50, 100)),
		);

		return fetchConnectorJson({ url: url.toString(), token });
	}

	throw new AssistantError("Unsupported Vercel operation", ErrorType.PARAMS_ERROR, 400);
}
