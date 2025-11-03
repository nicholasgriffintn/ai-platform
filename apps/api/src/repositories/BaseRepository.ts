import type { IEnv } from "~/types";
import { QueryBuilder } from "~/lib/database/QueryBuilder";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]*$/;

const logger = getLogger({ prefix: "repositories/BaseRepository" });

export abstract class BaseRepository {
	protected env: IEnv;

	constructor(env: IEnv) {
		if (!env?.DB) {
			throw new AssistantError(
				"Database not configured",
				ErrorType.CONFIGURATION_ERROR,
			);
		}
		this.env = env;
	}

	protected async runQuery<T>(
		query: string,
		params: any[],
		returnFirst: true,
	): Promise<T | null>;
	protected async runQuery<T>(
		query: string,
		params?: any[],
		returnFirst?: false,
	): Promise<T[]>;
	protected async runQuery<T>(
		query: string,
		params: any[] = [],
		returnFirst = false,
	): Promise<T | T[] | null> {
		if (!this.env.DB) {
			throw new AssistantError(
				"DB is not configured in runQuery",
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		try {
			const stmt = this.env.DB.prepare(query);
			const bound = stmt.bind(...params);

			if (returnFirst) {
				const result = await bound.first();
				return result as T | null;
			}

			const result = await bound.all();
			return result.results as T[];
		} catch (error: any) {
			logger.error("Database query error:", { error });
			throw new AssistantError(
				`Error executing database query: ${error.message}`,
				ErrorType.UNKNOWN_ERROR,
				500,
				{ originalError: error },
			);
		}
	}

	protected async executeRun(
		query: string,
		params: any[] = [],
	): Promise<D1Result<unknown>> {
		if (!this.env.DB) {
			throw new AssistantError(
				"DB is not configured in executeRun",
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		try {
			const stmt = this.env.DB.prepare(query);
			const bound = stmt.bind(...params);
			const result = await bound.run();

			if (!result.success) {
				throw new AssistantError(
					"Database operation failed",
					ErrorType.UNKNOWN_ERROR,
					500,
					{ meta: result.meta },
				);
			}

			return result;
		} catch (error: any) {
			if (error instanceof AssistantError) {
				throw error;
			}
			logger.error("Database execution error:", { error });
			throw new AssistantError(
				`Error executing database operation: ${error.message}`,
				ErrorType.UNKNOWN_ERROR,
				500,
				{ originalError: error },
			);
		}
	}

	protected buildUpdateQuery(
		table: string,
		updates: Record<string, unknown>,
		allowedFields: string[],
		whereClause: string,
		whereValues: unknown[] = [],
		options: {
			jsonFields?: string[];
			transformer?: (field: string, value: unknown) => unknown;
			returning?: string;
		} = {},
	): { query: string; values: unknown[] } | null {
		const builder = new QueryBuilder()
			.update(table)
			.set(updates, allowedFields, {
				jsonFields: options.jsonFields,
				transformer: options.transformer,
			});

		if (whereClause) {
			builder.where(whereClause, whereValues);
		}

		if (options.returning) {
			builder.returning(options.returning);
		}

		return builder.build();
	}

	protected buildInsertQuery(
		table: string,
		data: Record<string, unknown>,
		options: {
			jsonFields?: string[];
			returning?: string;
		} = {},
	): { query: string; values: unknown[] } | null {
		const builder = new QueryBuilder()
			.insert(table)
			.values(data, { jsonFields: options.jsonFields });

		if (options.returning) {
			builder.returning(options.returning);
		}

		return builder.build();
	}

	protected buildSelectQuery(
		table: string,
		conditions: Record<string, unknown> = {},
		options: {
			columns?: string[];
			orderBy?: string;
			limit?: number;
			offset?: number;
		} = {},
	): { query: string; values: unknown[] } {
		const builder = new QueryBuilder().select(
			options.columns && options.columns.length > 0
				? options.columns
				: ["*"],
		);

		builder.from(table);

		const { clause, values } = this.buildWhereFromConditions(conditions);

		if (clause) {
			builder.where(clause, values);
		}

		if (options.orderBy) {
			builder.orderBy(options.orderBy);
		}

		if (typeof options.limit === "number") {
			builder.limit(options.limit);
		}

		if (typeof options.offset === "number") {
			builder.offset(options.offset);
		}

		const result = builder.build();

		if (!result) {
			return { query: "", values: [] };
		}

		return result;
	}

	protected buildDeleteQuery(
		table: string,
		conditions: Record<string, unknown> = {},
		options: {
			returning?: string;
		} = {},
	): { query: string; values: unknown[] } {
		const builder = new QueryBuilder().delete(table);

		const { clause, values } = this.buildWhereFromConditions(conditions);

		if (clause) {
			builder.where(clause, values);
		}

		if (options.returning) {
			builder.returning(options.returning);
		}

		const result = builder.build();

		if (!result) {
			return { query: "", values: [] };
		}

		return result;
	}

	private buildWhereFromConditions(conditions: Record<string, unknown>): {
		clause: string;
		values: unknown[];
	} {
		const clauses: string[] = [];
		const values: unknown[] = [];

		for (const [field, value] of Object.entries(conditions)) {
			if (value === undefined) {
				continue;
			}

			const sanitizedField = this.sanitizeIdentifier(field);

			if (value === null) {
				clauses.push(`${sanitizedField} IS NULL`);
				continue;
			}

			if (Array.isArray(value)) {
				if (value.length === 0) {
					continue;
				}
				const placeholders = value.map(() => "?").join(", ");
				clauses.push(`${sanitizedField} IN (${placeholders})`);
				values.push(...value);
				continue;
			}

			clauses.push(`${sanitizedField} = ?`);
			values.push(value);
		}

		return {
			clause: clauses.join(" AND "),
			values,
		};
	}

	private sanitizeIdentifier(identifier: string): string {
		const trimmed = identifier.trim();
		if (!trimmed) {
			throw new AssistantError(
				"Invalid identifier: empty value",
				ErrorType.UNKNOWN_ERROR,
			);
		}

		if (trimmed === "*") {
			return trimmed;
		}

		const parts = trimmed.split(".");

		const sanitizedParts = parts.map((part, index) => {
			if (!part) {
				throw new AssistantError(
					`Invalid identifier: ${identifier}`,
					ErrorType.UNKNOWN_ERROR,
				);
			}

			if (part === "*") {
				if (index !== parts.length - 1) {
					throw new AssistantError(
						`Invalid identifier: ${identifier}`,
						ErrorType.UNKNOWN_ERROR,
					);
				}
				return part;
			}

			if (!IDENTIFIER_PATTERN.test(part)) {
				throw new AssistantError(
					`Invalid identifier: ${identifier}`,
					ErrorType.UNKNOWN_ERROR,
				);
			}

			return part;
		});

		return sanitizedParts.join(".");
	}
}
