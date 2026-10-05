import {
  nativeRecordColumnValueSchema,
  type NativeRecordDefinition,
  type NativeRecordFilter,
  type NativeRecordQuery,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { escapeSqlLikePattern } from "@ngriffin_uk/polychat-utility-server/sql";

export function compileNativeRecordQuery(
  definition: NativeRecordDefinition,
  query: NativeRecordQuery,
) {
  const clauses: string[] = [];
  const parameters: (string | number | null)[] = [];

  for (const filter of query.filters) {
    const column = definition.columns.find((item) => item.id === filter.columnId);

    if (!column) {
      throw new AssistantError("Filter column not found", ErrorType.PARAMS_ERROR, 400);
    }

    const path = `$.${column.id}`;

    if (filter.operator === "is_empty") {
      clauses.push("(json_extract(values_json, ?) IS NULL OR json_extract(values_json, ?) = '')");
      parameters.push(path, path);
      continue;
    }

    if (filter.value === undefined) {
      throw new AssistantError("A filter value is required", ErrorType.PARAMS_ERROR, 400);
    }

    if (filter.operator === "contains") {
      if (column.type !== "text" || typeof filter.value !== "string") {
        throw new AssistantError(
          "Contains requires a text column and text value",
          ErrorType.PARAMS_ERROR,
          400,
        );
      }

      clauses.push("json_extract(values_json, ?) LIKE ? ESCAPE '\\'");
      parameters.push(path, `%${escapeSqlLikePattern(filter.value)}%`);
      continue;
    }

    const validation = nativeRecordColumnValueSchema({ ...column, required: false }).safeParse(
      filter.value,
    );

    if (!validation.success) {
      throw new AssistantError(
        "The filter value does not match the column",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    if (filter.value === null) {
      if (filter.operator !== "eq" && filter.operator !== "ne") {
        throw new AssistantError(
          "Empty values only support equality filters",
          ErrorType.PARAMS_ERROR,
          400,
        );
      }

      clauses.push(`json_extract(values_json, ?) IS ${filter.operator === "ne" ? "NOT " : ""}NULL`);
      parameters.push(path);
      continue;
    }

    if (
      filter.operator !== "eq" &&
      filter.operator !== "ne" &&
      column.type !== "number" &&
      column.type !== "date"
    ) {
      throw new AssistantError(
        "Range filters require a number or date column",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    const operators: Record<
      Exclude<NativeRecordFilter["operator"], "contains" | "is_empty">,
      string
    > = {
      eq: "=",
      ne: "!=",
      gt: ">",
      gte: ">=",
      lt: "<",
      lte: "<=",
    };

    clauses.push(`json_extract(values_json, ?) ${operators[filter.operator]} ?`);
    parameters.push(path, typeof filter.value === "boolean" ? Number(filter.value) : filter.value);
  }

  let orderBy = "created_at, id";

  if (query.sort) {
    if (!definition.columns.some((column) => column.id === query.sort?.columnId)) {
      throw new AssistantError("Sort column not found", ErrorType.PARAMS_ERROR, 400);
    }

    orderBy = `json_extract(values_json, ?) ${query.sort.direction === "asc" ? "ASC" : "DESC"}, id`;
    parameters.push(`$.${query.sort.columnId}`);
  }

  return { where: clauses.length ? ` AND ${clauses.join(" AND ")}` : "", orderBy, parameters };
}
