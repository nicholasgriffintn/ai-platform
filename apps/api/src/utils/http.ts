import { safeParseJson } from "./json";

export function headersToRecord(headers: Headers): Record<string, string> {
	const result: Record<string, string> = {};
	headers.forEach((value, key) => {
		result[key] = value;
	});
	return result;
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
	const normalizedName = name.toLowerCase();
	return Object.keys(headers).some((key) => key.toLowerCase() === normalizedName);
}

export function setDefaultHeader(
	headers: Record<string, string>,
	name: string,
	value: string,
): void {
	if (!hasHeader(headers, name)) {
		headers[name] = value;
	}
}

export async function readHttpResponseBody(
	response: Response,
): Promise<{ parsed: unknown | null; raw: string; body: unknown; format: "json" | "text" }> {
	const raw = await response.text();
	if (!raw) {
		return { parsed: null, raw, body: raw, format: "text" };
	}

	const parsed = safeParseJson(raw);
	return {
		parsed,
		raw,
		body: parsed === null ? raw : parsed,
		format: parsed === null ? "text" : "json",
	};
}
