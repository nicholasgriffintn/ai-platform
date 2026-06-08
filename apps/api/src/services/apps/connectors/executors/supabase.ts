import { AssistantError, ErrorType } from "~/utils/errors";
import { fetchConnectorJson } from "./http";
import { getNumberParam, getStringParam, limitPositiveInteger } from "./params";

const SUPABASE_API_BASE_URL = "https://api.supabase.com/v1";

function requireSupabaseProjectRef(params: Record<string, unknown>): string {
	const projectRef = getStringParam(params, "projectRef") ?? getStringParam(params, "ref");
	if (!projectRef) {
		throw new AssistantError("projectRef is required", ErrorType.PARAMS_ERROR, 400);
	}

	return projectRef;
}

function addSupabasePagination(url: URL, params: Record<string, unknown>) {
	url.searchParams.set(
		"offset",
		String(Math.max(Math.floor(getNumberParam(params, "offset") ?? 0), 0)),
	);
	url.searchParams.set(
		"limit",
		String(limitPositiveInteger(getNumberParam(params, "limit"), 20, 100)),
	);
}

export async function executeSupabaseOperation(
	token: string,
	operation: string,
	params: Record<string, unknown>,
) {
	if (operation === "list_organizations") {
		const url = new URL(`${SUPABASE_API_BASE_URL}/organizations`);
		addSupabasePagination(url, params);

		return fetchConnectorJson({ url: url.toString(), token });
	}

	if (operation === "list_projects") {
		const organizationSlug = getStringParam(params, "organizationSlug");
		const url = new URL(
			organizationSlug
				? `${SUPABASE_API_BASE_URL}/organizations/${encodeURIComponent(organizationSlug)}/projects`
				: `${SUPABASE_API_BASE_URL}/projects`,
		);
		addSupabasePagination(url, params);

		return fetchConnectorJson({ url: url.toString(), token });
	}

	if (operation === "list_functions") {
		const projectRef = requireSupabaseProjectRef(params);

		return fetchConnectorJson({
			url: `${SUPABASE_API_BASE_URL}/projects/${encodeURIComponent(projectRef)}/functions`,
			token,
		});
	}

	if (operation === "list_branches") {
		const projectRef = requireSupabaseProjectRef(params);

		return fetchConnectorJson({
			url: `${SUPABASE_API_BASE_URL}/projects/${encodeURIComponent(projectRef)}/branches`,
			token,
		});
	}

	throw new AssistantError("Unsupported Supabase operation", ErrorType.PARAMS_ERROR, 400);
}
