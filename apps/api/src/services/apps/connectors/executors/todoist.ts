import { AssistantError, ErrorType } from "~/utils/errors";
import { coerceStringArray } from "~/utils/objects";
import { fetchConnectorJson } from "./http";
import { getNumberParam, getStringParam, limitPositiveInteger } from "./params";

function getTodoistLabels(params: Record<string, unknown>): string[] | undefined {
	const labels = coerceStringArray(params.labels)
		.map((label) => label.trim())
		.filter(Boolean)
		.slice(0, 20);

	return labels.length > 0 ? labels : undefined;
}

function getTodoistPriority(params: Record<string, unknown>): number | undefined {
	const priority = getNumberParam(params, "priority");
	if (priority === undefined) {
		return undefined;
	}
	if (priority < 1 || priority > 4) {
		throw new AssistantError("priority must be between 1 and 4", ErrorType.PARAMS_ERROR, 400);
	}

	return Math.floor(priority);
}

function buildTodoistCreateTaskBody(params: Record<string, unknown>) {
	const content = getStringParam(params, "content");
	if (!content) {
		throw new AssistantError("content is required", ErrorType.PARAMS_ERROR, 400);
	}

	return {
		content,
		description: getStringParam(params, "description"),
		project_id: getStringParam(params, "projectId"),
		section_id: getStringParam(params, "sectionId"),
		parent_id: getStringParam(params, "parentId"),
		labels: getTodoistLabels(params),
		priority: getTodoistPriority(params),
		due_string: getStringParam(params, "dueString"),
		due_date: getStringParam(params, "dueDate"),
		due_datetime: getStringParam(params, "dueDateTime"),
		due_lang: getStringParam(params, "dueLanguage"),
		deadline_date: getStringParam(params, "deadlineDate"),
	};
}

export async function executeTodoistOperation(
	token: string,
	operation: string,
	params: Record<string, unknown>,
) {
	if (operation === "list_tasks") {
		const url = new URL("https://api.todoist.com/api/v1/tasks");
		const projectId = getStringParam(params, "projectId");
		const sectionId = getStringParam(params, "sectionId");
		const parentId = getStringParam(params, "parentId");
		const label = getStringParam(params, "label");
		const cursor = getStringParam(params, "cursor");
		const ids = coerceStringArray(params.ids)
			.map((id) => id.trim())
			.filter(Boolean)
			.slice(0, 50);

		if (projectId) {
			url.searchParams.set("project_id", projectId);
		}
		if (sectionId) {
			url.searchParams.set("section_id", sectionId);
		}
		if (parentId) {
			url.searchParams.set("parent_id", parentId);
		}
		if (label) {
			url.searchParams.set("label", label);
		}
		if (ids.length > 0) {
			url.searchParams.set("ids", ids.join(","));
		}
		if (cursor) {
			url.searchParams.set("cursor", cursor);
		}
		url.searchParams.set(
			"limit",
			String(limitPositiveInteger(getNumberParam(params, "limit"), 25, 100)),
		);

		return fetchConnectorJson({ url: url.toString(), token });
	}

	if (operation === "create_task") {
		return fetchConnectorJson({
			url: "https://api.todoist.com/api/v1/tasks",
			token,
			method: "POST",
			body: buildTodoistCreateTaskBody(params),
		});
	}

	if (operation === "complete_task") {
		const taskId = getStringParam(params, "taskId");
		if (!taskId) {
			throw new AssistantError("taskId is required", ErrorType.PARAMS_ERROR, 400);
		}
		await fetchConnectorJson({
			url: `https://api.todoist.com/api/v1/tasks/${encodeURIComponent(taskId)}/close`,
			token,
			method: "POST",
			allowNullResponse: true,
		});
		return { completed: true, taskId };
	}

	throw new AssistantError("Unsupported Todoist operation", ErrorType.PARAMS_ERROR, 400);
}
