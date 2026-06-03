import type { IEnv } from "~/types";

function joinBaseUrl(baseUrl: string, path: string): string {
	return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export function buildAssetUrl(env: IEnv, assetId: string): string {
	const path = `/assets/${assetId}`;
	return env.API_BASE_URL ? joinBaseUrl(env.API_BASE_URL, path) : path;
}
