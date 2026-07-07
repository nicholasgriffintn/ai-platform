import { ZodError, type ZodType } from "zod";

const NO_STORE = "private, no-store";

export class HttpError extends Error {
	constructor(
		message: string,
		readonly status = 400,
	) {
		super(message);
		this.name = "HttpError";
	}
}

type JsonResponseOptions = {
	status?: number;
	cacheControl?: string;
	cacheTag?: string;
	vary?: string;
};

export function jsonResponse(
	data: unknown,
	statusOrOptions: number | JsonResponseOptions = 200,
): Response {
	const options =
		typeof statusOrOptions === "number" ? { status: statusOrOptions } : statusOrOptions;
	const headers = new Headers();

	headers.set("Cache-Control", options.cacheControl || NO_STORE);

	if (options.cacheTag) {
		headers.set("Cache-Tag", options.cacheTag);
	}

	if (options.vary) {
		headers.set("Vary", options.vary);
	}

	return Response.json(data, { status: options.status || 200, headers });
}

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
	let payload: unknown;

	try {
		payload = await request.json();
	} catch {
		throw new HttpError("Request body must be valid JSON", 400);
	}

	return schema.parse(payload);
}

export function errorResponse(error: unknown): Response {
	if (error instanceof HttpError) {
		return jsonResponse({ error: error.message }, error.status);
	}

	if (error instanceof ZodError) {
		return jsonResponse({ error: "Invalid request", details: error.issues }, 400);
	}

	if (error instanceof Error) {
		return jsonResponse({ error: error.message }, 500);
	}

	return jsonResponse({ error: "Unknown error" }, 500);
}
