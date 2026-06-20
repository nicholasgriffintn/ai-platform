import { AssistantError, ErrorType } from "~/utils/errors";
import { fetchConnectorJson } from "./http";
import { getNumberParam, getStringParam, limitPositiveInteger } from "./params";

const WEBFLOW_API_BASE_URL = "https://api.webflow.com/v2";

function requireWebflowSiteId(params: Record<string, unknown>): string {
	const siteId = getStringParam(params, "siteId") ?? getStringParam(params, "site_id");
	if (!siteId) {
		throw new AssistantError("siteId is required", ErrorType.PARAMS_ERROR, 400);
	}

	return siteId;
}

function requireWebflowCollectionId(params: Record<string, unknown>): string {
	const collectionId =
		getStringParam(params, "collectionId") ?? getStringParam(params, "collection_id");
	if (!collectionId) {
		throw new AssistantError("collectionId is required", ErrorType.PARAMS_ERROR, 400);
	}

	return collectionId;
}

function addWebflowPagination(url: URL, params: Record<string, unknown>) {
	url.searchParams.set(
		"offset",
		String(Math.max(Math.floor(getNumberParam(params, "offset") ?? 0), 0)),
	);
	url.searchParams.set(
		"limit",
		String(limitPositiveInteger(getNumberParam(params, "limit"), 20, 100)),
	);
}

function addWebflowStringFilter(url: URL, params: Record<string, unknown>, key: string) {
	const value = getStringParam(params, key);
	if (value) {
		url.searchParams.set(key, value);
	}
}

export async function executeWebflowOperation(
	token: string,
	operation: string,
	params: Record<string, unknown>,
) {
	if (operation === "list_sites") {
		return fetchConnectorJson({ url: `${WEBFLOW_API_BASE_URL}/sites`, token });
	}

	if (operation === "list_collections") {
		const siteId = requireWebflowSiteId(params);

		return fetchConnectorJson({
			url: `${WEBFLOW_API_BASE_URL}/sites/${encodeURIComponent(siteId)}/collections`,
			token,
		});
	}

	if (operation === "list_items") {
		const collectionId = requireWebflowCollectionId(params);
		const url = new URL(
			`${WEBFLOW_API_BASE_URL}/collections/${encodeURIComponent(collectionId)}/items`,
		);
		addWebflowPagination(url, params);
		addWebflowStringFilter(url, params, "cmsLocaleId");
		addWebflowStringFilter(url, params, "name");
		addWebflowStringFilter(url, params, "slug");
		addWebflowStringFilter(url, params, "sortBy");
		addWebflowStringFilter(url, params, "sortOrder");

		return fetchConnectorJson({ url: url.toString(), token });
	}

	throw new AssistantError("Unsupported Webflow operation", ErrorType.PARAMS_ERROR, 400);
}
