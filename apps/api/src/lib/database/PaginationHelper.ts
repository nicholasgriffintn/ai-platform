export interface PaginationParams {
	page: number;
	limit: number;
}

export interface PaginationResult {
	limit: number;
	offset: number;
}

export class PaginationHelper {
	static readonly DEFAULT_LIMIT = 25;

	static readonly MAX_LIMIT = 100;

	/**
	 * Calculate offset from page number and limit
	 * @param page - Page number (1-indexed)
	 * @param limit - Number of items per page
	 * @returns Pagination result with limit and offset
	 */
	static calculate(
		page: number,
		limit: number = PaginationHelper.DEFAULT_LIMIT,
	): PaginationResult {
		const safePage = Math.max(1, page);
		const safeLimit = Math.min(Math.max(1, limit), PaginationHelper.MAX_LIMIT);
		const offset = (safePage - 1) * safeLimit;

		return {
			limit: safeLimit,
			offset,
		};
	}

	/**
	 * Calculate offset directly from page number and limit
	 * @param page - Page number (1-indexed)
	 * @param limit - Number of items per page
	 * @returns The calculated offset
	 */
	static calculateOffset(
		page: number,
		limit: number = PaginationHelper.DEFAULT_LIMIT,
	): number {
		return PaginationHelper.calculate(page, limit).offset;
	}

	/**
	 * Build SQL LIMIT and OFFSET clause
	 * @param limit - Number of items per page
	 * @param offset - Offset value
	 * @returns SQL clause string
	 */
	static buildClause(limit: number, offset: number): string {
		return `LIMIT ${limit} OFFSET ${offset}`;
	}

	/**
	 * Apply pagination to a SQL query
	 * @param query - Base SQL query
	 * @param limit - Number of items per page
	 * @param offset - Offset value
	 * @returns Query with pagination clause appended
	 */
	static applyToQuery(query: string, limit: number, offset: number): string {
		const trimmedQuery = query.trim();
		return `${trimmedQuery} ${PaginationHelper.buildClause(limit, offset)}`;
	}

	/**
	 * Apply pagination to a query using page number
	 * @param query - Base SQL query
	 * @param page - Page number (1-indexed)
	 * @param limit - Number of items per page
	 * @returns Query with pagination clause appended
	 */
	static applyToQueryByPage(
		query: string,
		page: number,
		limit: number = PaginationHelper.DEFAULT_LIMIT,
	): string {
		const { limit: safeLimit, offset } = PaginationHelper.calculate(
			page,
			limit,
		);
		return PaginationHelper.applyToQuery(query, safeLimit, offset);
	}

	/**
	 * Normalize page and limit parameters
	 * @param page - Raw page number
	 * @param limit - Raw limit value
	 * @returns Normalized pagination params
	 */
	static normalize(
		page?: number | string,
		limit?: number | string,
	): PaginationParams {
		const normalizedPage = Math.max(
			1,
			Number.parseInt(String(page || 1), 10) || 1,
		);
		const normalizedLimit = Math.min(
			Math.max(
				1,
				Number.parseInt(String(limit || PaginationHelper.DEFAULT_LIMIT), 10) ||
					PaginationHelper.DEFAULT_LIMIT,
			),
			PaginationHelper.MAX_LIMIT,
		);

		return {
			page: normalizedPage,
			limit: normalizedLimit,
		};
	}
}
