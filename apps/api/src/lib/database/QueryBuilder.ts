const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]*$/;

type QueryType = "SELECT" | "INSERT" | "UPDATE" | "DELETE";

export class QueryBuilder {
	private queryType: QueryType | null = null;
	private tableName = "";
	private selectColumns: string[] = [];
	private insertColumns: string[] = [];
	private insertValues: any[] = [];
	private setClauses: string[] = [];
	private setValues: any[] = [];
	private whereClause = "";
	private whereValues: any[] = [];
	private orderByClause = "";
	private limitValue: number | null = null;
	private offsetValue: number | null = null;
	private returningClause = "";

	/**
	 * Start a SELECT query
	 */
	public select(columns: string[] = ["*"]): this {
		this.queryType = "SELECT";
		this.selectColumns = columns.map((column) => this.sanitizeColumn(column));
		return this;
	}

	/**
	 * Specify the table for SELECT, UPDATE, or DELETE
	 */
	public from(table: string): this {
		this.tableName = this.sanitizeIdentifier(table);
		return this;
	}

	/**
	 * Start an INSERT query
	 */
	public insert(table: string): this {
		this.queryType = "INSERT";
		this.tableName = this.sanitizeIdentifier(table);
		return this;
	}

	/**
	 * Specify values for INSERT query
	 *
	 * @param data - Object containing field values
	 * @param options - Configuration options
	 * @param options.jsonFields - Fields that should be JSON.stringify'd if they're objects
	 */
	public values(
		data: Record<string, unknown>,
		options: {
			jsonFields?: string[];
		} = {},
	): this {
		const { jsonFields = [] } = options;

		for (const [field, value] of Object.entries(data)) {
			if (value === undefined) continue;

			let processedValue = value;

			if (
				jsonFields.includes(field) &&
				value !== null &&
				(typeof value === "object" || Array.isArray(value))
			) {
				processedValue = JSON.stringify(value);
			}

			const sanitizedField = this.sanitizeIdentifier(field);
			this.insertColumns.push(sanitizedField);
			this.insertValues.push(processedValue);
		}

		return this;
	}

	/**
	 * Start an UPDATE query
	 */
	public update(table: string): this {
		this.queryType = "UPDATE";
		this.tableName = this.sanitizeIdentifier(table);
		return this;
	}

	/**
	 * Build SET clause from updates object
	 *
	 * @param updates - Object containing field updates
	 * @param allowedFields - Array of allowed field names
	 * @param options - Configuration options
	 * @param options.jsonFields - Fields that should be JSON.stringify'd if they're objects
	 * @param options.transformer - Custom field transformer function
	 */
	public set(
		updates: Record<string, unknown>,
		allowedFields: string[],
		options: {
			jsonFields?: string[];
			transformer?: (field: string, value: unknown) => unknown;
		} = {},
	): this {
		const { jsonFields = [], transformer } = options;

		for (const field of allowedFields) {
			if (updates[field] === undefined) continue;

			let value = updates[field];

			if (
				jsonFields.includes(field) &&
				value !== null &&
				(typeof value === "object" || Array.isArray(value))
			) {
				value = JSON.stringify(value);
			}

			if (transformer) {
				value = transformer(field, value);
			}

			const sanitizedField = this.sanitizeIdentifier(field);
			this.setClauses.push(`${sanitizedField} = ?`);
			this.setValues.push(value);
		}

		return this;
	}

	/**
	 * Start a DELETE query
	 */
	public delete(table: string): this {
		this.queryType = "DELETE";
		this.tableName = this.sanitizeIdentifier(table);
		return this;
	}

	/**
	 * Add WHERE clause
	 *
	 * @param condition - SQL WHERE condition with ? placeholders
	 * @param values - Values for the placeholders
	 */
	public where(condition: string, values: any[] = []): this {
		const sanitizedCondition = this.sanitizeWhereCondition(condition);
		if (this.whereClause) {
			this.whereClause += ` AND ${sanitizedCondition}`;
			this.whereValues = [...this.whereValues, ...values];
		} else {
			this.whereClause = sanitizedCondition;
			this.whereValues = [...values];
		}
		return this;
	}

	/**
	 * Add ORDER BY clause
	 *
	 * @param clause - ORDER BY clause (e.g., "created_at DESC")
	 */
	public orderBy(clause: string): this {
		this.orderByClause = this.sanitizeOrderByClause(clause);
		return this;
	}

	/**
	 * Add LIMIT clause
	 *
	 * @param limit - Number of rows to limit
	 */
	public limit(limit: number): this {
		this.limitValue = limit;
		return this;
	}

	/**
	 * Add OFFSET clause
	 *
	 * @param offset - Number of rows to skip
	 */
	public offset(offset: number): this {
		this.offsetValue = offset;
		return this;
	}

	/**
	 * Add RETURNING clause (for INSERT/UPDATE/DELETE)
	 *
	 * @param columns - Columns to return (default: "*")
	 */
	public returning(columns: string = "*"): this {
		this.returningClause = this.sanitizeReturningClause(columns);
		return this;
	}

	/**
	 * Build the final query and values array
	 *
	 * @returns Object with query string and values array, or null if query cannot be built
	 */
	public build(): { query: string; values: any[] } | null {
		if (!this.queryType || !this.tableName) {
			return null;
		}

		let query = "";
		let values: any[] = [];

		switch (this.queryType) {
			case "SELECT":
				query = this.buildSelectQuery();
				values = [...this.whereValues];
				break;

			case "INSERT":
				if (this.insertColumns.length === 0) {
					return null;
				}
				query = this.buildInsertQuery();
				values = [...this.insertValues];
				break;

			case "UPDATE":
				if (this.setClauses.length === 0) {
					return null;
				}
				query = this.buildUpdateQuery();
				values = [...this.setValues, ...this.whereValues];
				break;

			case "DELETE":
				query = this.buildDeleteQuery();
				values = [...this.whereValues];
				break;
		}

		return { query, values };
	}

	private buildSelectQuery(): string {
		const columns = this.selectColumns.join(", ");
		let query = `SELECT ${columns} FROM ${this.tableName}`;

		if (this.whereClause) {
			query += ` WHERE ${this.whereClause}`;
		}

		if (this.orderByClause) {
			query += ` ORDER BY ${this.orderByClause}`;
		}

		if (this.limitValue !== null) {
			query += ` LIMIT ${this.limitValue}`;
		}

		if (this.offsetValue !== null) {
			query += ` OFFSET ${this.offsetValue}`;
		}

		return query;
	}

	private buildInsertQuery(): string {
		const columns = this.insertColumns.join(", ");
		const placeholders = this.insertColumns.map(() => "?").join(", ");
		let query = `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`;

		if (this.returningClause) {
			query += ` RETURNING ${this.returningClause}`;
		}

		return query;
	}

	private buildUpdateQuery(): string {
		const setClause = this.setClauses.join(", ");
		let query = `UPDATE ${this.tableName} SET ${setClause}, updated_at = datetime('now')`;

		if (this.whereClause) {
			query += ` WHERE ${this.whereClause}`;
		}

		if (this.returningClause) {
			query += ` RETURNING ${this.returningClause}`;
		}

		return query;
	}

	private buildDeleteQuery(): string {
		let query = `DELETE FROM ${this.tableName}`;

		if (this.whereClause) {
			query += ` WHERE ${this.whereClause}`;
		}

		if (this.returningClause) {
			query += ` RETURNING ${this.returningClause}`;
		}

		return query;
	}

	private sanitizeIdentifier(identifier: string): string {
		const trimmed = identifier.trim();
		if (!trimmed) {
			throw new Error("Invalid identifier: empty value");
		}

		if (trimmed === "*") {
			return trimmed;
		}

		const parts = trimmed.split(".");

		const sanitizedParts = parts.map((part, index) => {
			if (!part) {
				throw new Error(`Invalid identifier: ${identifier}`);
			}

			if (part === "*") {
				if (index !== parts.length - 1) {
					throw new Error(`Invalid identifier: ${identifier}`);
				}
				return part;
			}

			if (!IDENTIFIER_PATTERN.test(part)) {
				throw new Error(`Invalid identifier: ${identifier}`);
			}

			return part;
		});

		return sanitizedParts.join(".");
	}

	private sanitizeColumn(column: string): string {
		const trimmed = column.trim();

		if (!trimmed) {
			throw new Error("Invalid column identifier: empty value");
		}

		if (trimmed === "*") {
			return trimmed;
		}

		const [base, alias] = trimmed.split(/\s+AS\s+/i).map((part) => part.trim());
		let sanitizedBase = base;

		const functionMatch = base.match(/^([A-Za-z_][A-Za-z0-9_$]*)\((.*)\)$/);

		if (functionMatch) {
			const [, fnName, arg] = functionMatch;
			if (!IDENTIFIER_PATTERN.test(fnName)) {
				throw new Error(`Invalid function identifier: ${fnName}`);
			}
			const argTrimmed = arg.trim();
			if (argTrimmed === "*") {
				sanitizedBase = `${fnName}(${argTrimmed})`;
			} else {
				const sanitizedArg = this.sanitizeIdentifier(argTrimmed);
				sanitizedBase = `${fnName}(${sanitizedArg})`;
			}
		} else if (base.endsWith(".*")) {
			const prefix = base.slice(0, -2);
			sanitizedBase = `${this.sanitizeIdentifier(prefix)}.*`;
		} else {
			sanitizedBase = this.sanitizeIdentifier(base);
		}

		if (!alias) {
			return sanitizedBase;
		}

		const sanitizedAlias = this.sanitizeIdentifier(alias);
		return `${sanitizedBase} AS ${sanitizedAlias}`;
	}

	private sanitizeOrderByClause(clause: string): string {
		const trimmed = clause.trim();
		if (!trimmed) {
			throw new Error("Invalid ORDER BY clause: empty value");
		}

		const segments = trimmed.split(",");

		const sanitizedSegments = segments.map((segment) => {
			const segmentTrimmed = segment.trim();
			if (!segmentTrimmed) {
				throw new Error("Invalid ORDER BY clause: empty segment");
			}

			const parts = segmentTrimmed.split(/\s+/);
			if (parts.length > 2) {
				throw new Error(`Invalid ORDER BY segment: ${segmentTrimmed}`);
			}

			const column = this.sanitizeIdentifier(parts[0]);

			if (parts.length === 1) {
				return column;
			}

			const direction = parts[1].toUpperCase();
			if (direction !== "ASC" && direction !== "DESC") {
				throw new Error(`Invalid ORDER BY direction: ${parts[1]}`);
			}

			return `${column} ${direction}`;
		});

		return sanitizedSegments.join(", ");
	}

	private sanitizeReturningClause(clause: string): string {
		const trimmed = clause.trim();
		if (!trimmed) {
			throw new Error("Invalid RETURNING clause: empty value");
		}

		if (trimmed === "*") {
			return trimmed;
		}

		const columns = trimmed.split(",");
		return columns.map((column) => this.sanitizeColumn(column)).join(", ");
	}

	private sanitizeWhereCondition(condition: string): string {
		const trimmed = condition.trim();

		if (!trimmed) {
			throw new Error("Invalid WHERE condition: empty value");
		}

		if (/[;]|--|\/\*/.test(trimmed)) {
			throw new Error(
				"Invalid WHERE condition: contains disallowed characters",
			);
		}

		return trimmed;
	}

	/**
	 * Reset the builder to initial state
	 */
	public reset(): this {
		this.queryType = null;
		this.tableName = "";
		this.selectColumns = [];
		this.insertColumns = [];
		this.insertValues = [];
		this.setClauses = [];
		this.setValues = [];
		this.whereClause = "";
		this.whereValues = [];
		this.orderByClause = "";
		this.limitValue = null;
		this.offsetValue = null;
		this.returningClause = "";
		return this;
	}
}
