import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export type ResponseStatus = "success" | "error";

export interface BaseResponse<T = unknown> {
	status: ResponseStatus;
	data?: T;
	message?: string;
}

export interface PaginationMeta {
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export interface PaginatedResponse<T = unknown> {
	status: ResponseStatus;
	data: T;
	pagination: PaginationMeta;
}

export class ResponseFactory {
	static success<T>(
		context: Context,
		data: T,
		statusCode: ContentfulStatusCode = 200,
	) {
		return context.json(data, statusCode);
	}

	static error(
		context: Context,
		message: string,
		statusCode: ContentfulStatusCode = 400,
	) {
		return context.json(
			{
				status: "error" as const,
				message,
			},
			statusCode,
		);
	}

	static paginated<T>(
		context: Context,
		data: T,
		pagination: {
			total: number;
			page: number;
			limit: number;
		},
		statusCode: ContentfulStatusCode = 200,
	) {
		const totalPages = Math.ceil(pagination.total / pagination.limit);

		return context.json(
			{
				status: "success" as const,
				data,
				pagination: {
					total: pagination.total,
					page: pagination.page,
					limit: pagination.limit,
					totalPages,
				},
			},
			statusCode,
		);
	}

	static message(
		context: Context,
		message: string,
		statusCode: ContentfulStatusCode = 200,
	) {
		return context.json(
			{
				status: "success" as const,
				message,
			},
			statusCode,
		);
	}

	static noContent(context: Context) {
		return context.body(null, 204);
	}
}
