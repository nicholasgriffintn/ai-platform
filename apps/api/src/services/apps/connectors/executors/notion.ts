import { AssistantError, ErrorType } from "~/utils/errors";
import { fetchConnectorJson } from "./http";
import { getNumberParam, getRecordParam, getStringParam, limitPositiveInteger } from "./params";

function buildNotionParagraphBlocks(content: string) {
	return content
		.split(/\n{2,}/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean)
		.slice(0, 100)
		.map((paragraph) => ({
			object: "block",
			type: "paragraph",
			paragraph: {
				rich_text: [
					{
						type: "text",
						text: {
							content: paragraph.slice(0, 2000),
						},
					},
				],
			},
		}));
}

function getNotionHeaders() {
	return {
		"Notion-Version": "2026-03-11",
	};
}

export async function executeNotionOperation(
	token: string,
	operation: string,
	params: Record<string, unknown>,
) {
	if (operation === "search") {
		const query = getStringParam(params, "query");
		const filterType = getStringParam(params, "filterType");
		const body: Record<string, unknown> = {
			page_size: limitPositiveInteger(getNumberParam(params, "maxResults"), 10, 25),
		};
		if (query) {
			body.query = query;
		}
		if (filterType === "page" || filterType === "database") {
			body.filter = { property: "object", value: filterType };
		}
		const startCursor = getStringParam(params, "startCursor");
		if (startCursor) {
			body.start_cursor = startCursor;
		}

		return fetchConnectorJson({
			url: "https://api.notion.com/v1/search",
			token,
			method: "POST",
			headers: getNotionHeaders(),
			body,
		});
	}

	if (operation === "retrieve_page") {
		const pageId = getStringParam(params, "pageId");
		if (!pageId) {
			throw new AssistantError("pageId is required", ErrorType.PARAMS_ERROR, 400);
		}
		return fetchConnectorJson({
			url: `https://api.notion.com/v1/pages/${encodeURIComponent(pageId)}`,
			token,
			headers: getNotionHeaders(),
		});
	}

	if (operation === "create_page") {
		const parentPageId = getStringParam(params, "parentPageId");
		const databaseId = getStringParam(params, "databaseId");
		const title = getStringParam(params, "title");
		if (!parentPageId && !databaseId) {
			throw new AssistantError(
				"parentPageId or databaseId is required",
				ErrorType.PARAMS_ERROR,
				400,
			);
		}
		if (!title && !getRecordParam(params, "properties")) {
			throw new AssistantError("title or properties is required", ErrorType.PARAMS_ERROR, 400);
		}
		const properties = getRecordParam(params, "properties") ?? {
			title: {
				title: [
					{
						text: {
							content: title,
						},
					},
				],
			},
		};
		const content = getStringParam(params, "content");

		return fetchConnectorJson({
			url: "https://api.notion.com/v1/pages",
			token,
			method: "POST",
			headers: getNotionHeaders(),
			body: {
				parent: databaseId ? { database_id: databaseId } : { page_id: parentPageId },
				properties,
				...(content ? { children: buildNotionParagraphBlocks(content) } : {}),
			},
		});
	}

	if (operation === "append_block_children") {
		const blockId = getStringParam(params, "blockId") ?? getStringParam(params, "pageId");
		const content = getStringParam(params, "content");
		if (!blockId || !content) {
			throw new AssistantError(
				"blockId/pageId and content are required",
				ErrorType.PARAMS_ERROR,
				400,
			);
		}
		return fetchConnectorJson({
			url: `https://api.notion.com/v1/blocks/${encodeURIComponent(blockId)}/children`,
			token,
			method: "PATCH",
			headers: getNotionHeaders(),
			body: { children: buildNotionParagraphBlocks(content) },
		});
	}

	throw new AssistantError("Unsupported Notion operation", ErrorType.PARAMS_ERROR, 400);
}
