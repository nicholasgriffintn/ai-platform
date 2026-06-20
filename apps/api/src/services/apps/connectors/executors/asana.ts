import { AssistantError, ErrorType } from "~/utils/errors";
import { coerceStringArray } from "~/utils/objects";
import { fetchConnectorJson } from "./http";
import { getNumberParam, getStringParam, limitPositiveInteger } from "./params";

const ASANA_API_BASE_URL = "https://app.asana.com/api/1.0";

function getAsanaStringList(params: Record<string, unknown>, key: string): string[] | undefined {
	const values = coerceStringArray(params[key])
		.map((value) => value.trim())
		.filter(Boolean)
		.slice(0, 20);

	return values.length > 0 ? values : undefined;
}

function buildAsanaCreateTaskBody(params: Record<string, unknown>) {
	const name = getStringParam(params, "name") ?? getStringParam(params, "title");
	if (!name) {
		throw new AssistantError("name is required", ErrorType.PARAMS_ERROR, 400);
	}

	const projectIds = getAsanaStringList(params, "projectIds");
	const workspace = getStringParam(params, "workspaceId") ?? getStringParam(params, "workspace");
	if (!workspace && !projectIds?.length) {
		throw new AssistantError("workspaceId or projectIds is required", ErrorType.PARAMS_ERROR, 400);
	}

	return {
		data: {
			name,
			notes: getStringParam(params, "notes") ?? getStringParam(params, "description"),
			workspace,
			projects: projectIds,
			assignee: getStringParam(params, "assignee"),
			due_on: getStringParam(params, "dueOn") ?? getStringParam(params, "dueDate"),
			due_at: getStringParam(params, "dueAt") ?? getStringParam(params, "dueDateTime"),
		},
	};
}

export async function executeAsanaOperation(
	token: string,
	operation: string,
	params: Record<string, unknown>,
) {
	if (operation === "list_projects") {
		const url = new URL(`${ASANA_API_BASE_URL}/projects`);
		const workspace = getStringParam(params, "workspaceId") ?? getStringParam(params, "workspace");
		if (workspace) {
			url.searchParams.set("workspace", workspace);
		}
		url.searchParams.set(
			"limit",
			String(limitPositiveInteger(getNumberParam(params, "limit"), 25, 100)),
		);
		url.searchParams.set("opt_fields", "gid,name,permalink_url,workspace.name");

		return fetchConnectorJson({ url: url.toString(), token });
	}

	if (operation === "list_tasks") {
		const projectId = getStringParam(params, "projectId");
		const url = new URL(
			projectId
				? `${ASANA_API_BASE_URL}/projects/${encodeURIComponent(projectId)}/tasks`
				: `${ASANA_API_BASE_URL}/tasks`,
		);
		const workspace = getStringParam(params, "workspaceId") ?? getStringParam(params, "workspace");
		const assignee = getStringParam(params, "assignee");

		if (!projectId && (!workspace || !assignee)) {
			throw new AssistantError(
				"projectId or workspaceId and assignee are required",
				ErrorType.PARAMS_ERROR,
				400,
			);
		}
		if (workspace) {
			url.searchParams.set("workspace", workspace);
		}
		if (assignee) {
			url.searchParams.set("assignee", assignee);
		}
		url.searchParams.set(
			"limit",
			String(limitPositiveInteger(getNumberParam(params, "limit"), 25, 100)),
		);
		url.searchParams.set(
			"opt_fields",
			"gid,name,completed,due_on,due_at,permalink_url,projects.name,assignee.name",
		);

		return fetchConnectorJson({ url: url.toString(), token });
	}

	if (operation === "create_task") {
		return fetchConnectorJson({
			url: `${ASANA_API_BASE_URL}/tasks?opt_fields=gid,name,permalink_url,completed,due_on,due_at,projects.name`,
			token,
			method: "POST",
			body: buildAsanaCreateTaskBody(params),
		});
	}

	throw new AssistantError("Unsupported Asana operation", ErrorType.PARAMS_ERROR, 400);
}
