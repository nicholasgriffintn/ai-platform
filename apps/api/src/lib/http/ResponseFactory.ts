import type { Context } from "hono";

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
	static success<T>(context: Context, data: T, statusCode: number = 200) {
		return context.json(
			{
				status: "success" as const,
				data,
			},
			statusCode as any,
		);
	}

	static error(context: Context, message: string, statusCode: number = 400) {
		return context.json(
			{
				status: "error" as const,
				message,
			},
			statusCode as any,
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
		statusCode: number = 200,
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
			statusCode as any,
		);
	}

	static message(context: Context, message: string, statusCode: number = 200) {
		return context.json(
			{
				status: "success" as const,
				message,
			},
			statusCode as any,
		);
	}

	static noContent(context: Context) {
		return context.body(null, 204);
	}
}
