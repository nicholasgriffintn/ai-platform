import { ZodError, type ZodType } from "zod";

export class HttpError extends Error {
	constructor(
		message: string,
		readonly status = 400,
	) {
		super(message);
		this.name = "HttpError";
	}
}

export function jsonResponse(data: unknown, status = 200): Response {
	return Response.json(data, { status });
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
