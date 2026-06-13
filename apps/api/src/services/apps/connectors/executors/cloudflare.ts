import { AssistantError, ErrorType } from "~/utils/errors";
import { isRecord } from "~/utils/objects";
import { fetchConnectorJson } from "./http";
import { getNumberParam, getStringParam, limitPositiveInteger } from "./params";

const CLOUDFLARE_API_BASE_URL = "https://api.cloudflare.com/client/v4";

function requireCloudflareAccountId(params: Record<string, unknown>): string {
	const accountId = getStringParam(params, "accountId") ?? getStringParam(params, "account_id");
	if (!accountId) {
		throw new AssistantError("accountId is required", ErrorType.PARAMS_ERROR, 400);
	}

	return accountId;
}

function requireCloudflareScriptName(params: Record<string, unknown>): string {
	const scriptName = getStringParam(params, "scriptName") ?? getStringParam(params, "script_name");
	if (!scriptName) {
		throw new AssistantError("scriptName is required", ErrorType.PARAMS_ERROR, 400);
	}

	return scriptName;
}

function requireCloudflareDeploymentId(params: Record<string, unknown>): string {
	const deploymentId =
		getStringParam(params, "deploymentId") ?? getStringParam(params, "deployment_id");
	if (!deploymentId) {
		throw new AssistantError("deploymentId is required", ErrorType.PARAMS_ERROR, 400);
	}

	return deploymentId;
}

function addCloudflarePagination(url: URL, params: Record<string, unknown>) {
	url.searchParams.set(
		"page",
		String(limitPositiveInteger(getNumberParam(params, "page"), 1, 1000)),
	);
	url.searchParams.set(
		"per_page",
		String(limitPositiveInteger(getNumberParam(params, "perPage"), 20, 50)),
	);
}

function addCloudflareSearchParam(url: URL, params: Record<string, unknown>, key: string) {
	const value = getStringParam(params, key);
	if (value) {
		url.searchParams.set(key, value);
	}
}

async function fetchCloudflareJson(params: { token: string; url: string }) {
	const data = await fetchConnectorJson(params);
	if (!isRecord(data)) {
		throw new AssistantError(
			"Cloudflare API response is invalid",
			ErrorType.EXTERNAL_API_ERROR,
			502,
		);
	}

	if (data.success === false) {
		throw new AssistantError("Cloudflare API request failed", ErrorType.EXTERNAL_API_ERROR, 502);
	}

	return data;
}

export async function executeCloudflareOperation(
	token: string,
	operation: string,
	params: Record<string, unknown>,
) {
	if (operation === "list_accounts") {
		const url = new URL(`${CLOUDFLARE_API_BASE_URL}/accounts`);
		addCloudflarePagination(url, params);
		addCloudflareSearchParam(url, params, "name");

		return fetchCloudflareJson({ url: url.toString(), token });
	}

	if (operation === "list_zones") {
		const url = new URL(`${CLOUDFLARE_API_BASE_URL}/zones`);
		addCloudflarePagination(url, params);
		addCloudflareSearchParam(url, params, "name");
		addCloudflareSearchParam(url, params, "status");
		const accountId = getStringParam(params, "accountId") ?? getStringParam(params, "account_id");
		if (accountId) {
			url.searchParams.set("account.id", accountId);
		}

		return fetchCloudflareJson({ url: url.toString(), token });
	}

	if (operation === "list_workers") {
		const accountId = requireCloudflareAccountId(params);
		const url = new URL(
			`${CLOUDFLARE_API_BASE_URL}/accounts/${encodeURIComponent(accountId)}/workers/scripts`,
		);

		return fetchCloudflareJson({ url: url.toString(), token });
	}

	if (operation === "list_worker_deployments") {
		const accountId = requireCloudflareAccountId(params);
		const scriptName = requireCloudflareScriptName(params);
		const url = new URL(
			`${CLOUDFLARE_API_BASE_URL}/accounts/${encodeURIComponent(accountId)}/workers/scripts/${encodeURIComponent(scriptName)}/deployments`,
		);

		return fetchCloudflareJson({ url: url.toString(), token });
	}

	if (operation === "get_worker_deployment") {
		const accountId = requireCloudflareAccountId(params);
		const scriptName = requireCloudflareScriptName(params);
		const deploymentId = requireCloudflareDeploymentId(params);

		return fetchCloudflareJson({
			url: `${CLOUDFLARE_API_BASE_URL}/accounts/${encodeURIComponent(accountId)}/workers/scripts/${encodeURIComponent(scriptName)}/deployments/${encodeURIComponent(deploymentId)}`,
			token,
		});
	}

	throw new AssistantError("Unsupported Cloudflare operation", ErrorType.PARAMS_ERROR, 400);
}
