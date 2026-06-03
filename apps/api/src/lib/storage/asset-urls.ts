import type { IEnv } from "~/types";

function joinBaseUrl(baseUrl: string, path: string): string {
	return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export function buildAssetUrl(env: IEnv, assetId: string): string {
	const path = `/assets/${assetId}`;
	return env.API_BASE_URL ? joinBaseUrl(env.API_BASE_URL, path) : path;
}

export function getAssetIdFromUrl(url: string, apiBaseUrl?: string): string | undefined {
	const trimmedApiBaseUrl = apiBaseUrl?.replace(/\/$/, "");
	const relativePrefix = "/assets/";

	if (trimmedApiBaseUrl && url.startsWith(`${trimmedApiBaseUrl}${relativePrefix}`)) {
		return url.slice(`${trimmedApiBaseUrl}${relativePrefix}`.length).split(/[?#/]/)[0];
	}

	if (url.startsWith(relativePrefix)) {
		return url.slice(relativePrefix.length).split(/[?#/]/)[0];
	}

	return undefined;
}
