import z from "zod/v4";

import { outputSchema } from "./outputs.js";

export const NATIVE_RECORDS_OUTPUT_KIND = "records";
export const NATIVE_RECORDS_CAPABILITY_ID = "records";
export const NATIVE_RECORD_MAX_BYTES = 64 * 1024;
export const NATIVE_RECORD_TABLE_MAX_ROWS = 10_000;
export const NATIVE_RECORD_READ_TOOL_NAME = "read_records";
export const NATIVE_RECORD_WRITE_TOOL_NAME = "write_records";

export const nativeRecordColumnIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,39}$/)
  .refine((id) => id !== "constructor" && id !== "prototype", "Choose a different column ID");
export const nativeRecordValueSchema = z.union([
  z.string().max(10_000),
  z.number(),
  z.boolean(),
  z.null(),
]);
export const nativeRecordValuesSchema = z
  .record(nativeRecordColumnIdSchema, nativeRecordValueSchema)
  .refine(
    (values) => new TextEncoder().encode(JSON.stringify(values)).length <= NATIVE_RECORD_MAX_BYTES,
    "A record cannot exceed 64 KiB",
  );
export type NativeRecordValue = z.infer<typeof nativeRecordValueSchema>;
export type NativeRecordValues = z.infer<typeof nativeRecordValuesSchema>;

const columnFields = {
  id: nativeRecordColumnIdSchema,
  name: z.string().trim().min(1).max(120),
  required: z.boolean().default(false),
};

export const nativeRecordColumnSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...columnFields,
      type: z.literal("text"),
      maxLength: z.number().int().min(1).max(10_000).default(5000),
    })
    .strict(),
  z
    .object({
      ...columnFields,
      type: z.literal("number"),
      minimum: z.number().optional(),
      maximum: z.number().optional(),
    })
    .strict()
    .refine(
      (column) =>
        column.minimum === undefined ||
        column.maximum === undefined ||
        column.minimum <= column.maximum,
      { message: "The minimum cannot exceed the maximum", path: ["maximum"] },
    ),
  z.object({ ...columnFields, type: z.literal("boolean") }).strict(),
  z.object({ ...columnFields, type: z.literal("date") }).strict(),
  z
    .object({
      ...columnFields,
      type: z.literal("select"),
      options: z
        .array(z.string().trim().min(1).max(120))
        .min(1)
        .max(50)
        .refine((values) => new Set(values).size === values.length, "Options must be unique"),
    })
    .strict(),
]);
export type NativeRecordColumn = z.infer<typeof nativeRecordColumnSchema>;

export const nativeRecordDefinitionSchema = z
  .object({
    format: z.literal("records"),
    columns: z.array(nativeRecordColumnSchema).min(1).max(64),
    visibility: z.enum(["shared", "creator"]).default("shared"),
    editing: z.enum(["shared", "creator"]).default("creator"),
  })
  .strict()
  .superRefine((definition, context) => {
    if (definition.visibility === "creator" && definition.editing === "shared") {
      context.addIssue({
        code: "custom",
        path: ["editing"],
        message: "Private records cannot allow shared editing",
      });
    }

    if (new Set(definition.columns.map((column) => column.id)).size !== definition.columns.length) {
      context.addIssue({ code: "custom", path: ["columns"], message: "Column IDs must be unique" });
    }
  });
export type NativeRecordDefinition = z.infer<typeof nativeRecordDefinitionSchema>;

export const createNativeRecordTableSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    projectId: z.string().min(1).optional(),
    definition: nativeRecordDefinitionSchema,
  })
  .strict();
export type CreateNativeRecordTableInput = z.infer<typeof createNativeRecordTableSchema>;

export const updateNativeRecordTableSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    title: z.string().trim().min(1).max(200).optional(),
    definition: nativeRecordDefinitionSchema,
  })
  .strict();
export type UpdateNativeRecordTableInput = z.infer<typeof updateNativeRecordTableSchema>;

export const nativeRecordTableResponseSchema = z.object({
  output: outputSchema,
  definition: nativeRecordDefinitionSchema,
  permissions: z.object({
    actorUserId: z.number().int().positive(),
    canManage: z.boolean(),
    canCreate: z.boolean(),
    canEditAllRows: z.boolean(),
  }),
});
export type NativeRecordTable = z.infer<typeof nativeRecordTableResponseSchema>;

export function nativeRecordColumnValueSchema(
  column: NativeRecordColumn,
): z.ZodType<NativeRecordValue | undefined> {
  let schema: z.ZodType<NativeRecordValue>;

  switch (column.type) {
    case "text":
      schema = column.required
        ? z.string().trim().min(1).max(column.maxLength)
        : z.string().max(column.maxLength);
      break;
    case "number": {
      let number = z.number();

      if (column.minimum !== undefined) {
        number = number.min(column.minimum);
      }

      if (column.maximum !== undefined) {
        number = number.max(column.maximum);
      }

      schema = number;
      break;
    }

    case "boolean":
      schema = z.boolean();
      break;
    case "date":
      schema = z.iso.date();
      break;
    case "select":
      schema = z.enum(column.options);
      break;
  }

  return column.required ? schema : schema.nullable().optional();
}

export function nativeRecordValuesForDefinitionSchema(definition: NativeRecordDefinition) {
  const shape = Object.fromEntries(
    definition.columns.map((column) => [column.id, nativeRecordColumnValueSchema(column)]),
  );

  return z.object(shape).strict().pipe(nativeRecordValuesSchema);
}

export function validateNativeRecordValues(
  definition: NativeRecordDefinition,
  values: unknown,
): NativeRecordValues {
  return nativeRecordValuesForDefinitionSchema(definition).parse(values);
}

export const nativeRecordSchema = z.object({
  id: z.string().min(1),
  tableId: z.string().min(1),
  createdByUserId: z.number().int().positive(),
  values: nativeRecordValuesSchema,
  revision: z.number().int().positive(),
  tableRevisionAtWrite: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  deletedAt: z.string().nullable(),
});
export type NativeRecord = z.infer<typeof nativeRecordSchema>;

export const nativeRecordFilterSchema = z
  .object({
    columnId: nativeRecordColumnIdSchema,
    operator: z.enum(["eq", "ne", "contains", "gt", "gte", "lt", "lte", "is_empty"]),
    value: nativeRecordValueSchema.optional(),
  })
  .strict()
  .superRefine((filter, context) => {
    if (filter.operator !== "is_empty" && filter.value === undefined) {
      context.addIssue({ code: "custom", path: ["value"], message: "Enter a filter value" });
    }
  });
export type NativeRecordFilter = z.infer<typeof nativeRecordFilterSchema>;

export const nativeRecordQuerySchema = z
  .object({
    filters: z.array(nativeRecordFilterSchema).max(10).default([]),
    sort: z
      .object({ columnId: nativeRecordColumnIdSchema, direction: z.enum(["asc", "desc"]) })
      .strict()
      .optional(),
    limit: z.number().int().min(1).max(100).default(100),
    offset: z.number().int().min(0).max(100_000).default(0),
  })
  .strict();
export type NativeRecordQuery = z.infer<typeof nativeRecordQuerySchema>;

export const nativeRecordViewSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/),
    tableId: z.string().min(1),
    title: z.string().trim().min(1).max(120),
    presentation: z.enum(["table", "board", "checklist"]),
    editable: z.boolean().default(false),
    columns: z.array(nativeRecordColumnIdSchema).min(1).max(64).optional(),
    groupColumnId: nativeRecordColumnIdSchema.optional(),
    checkedColumnId: nativeRecordColumnIdSchema.optional(),
    query: nativeRecordQuerySchema.omit({ offset: true, limit: true }).default({ filters: [] }),
  })
  .strict()
  .superRefine((view, context) => {
    if (view.presentation === "board" && !view.groupColumnId) {
      context.addIssue({
        code: "custom",
        path: ["groupColumnId"],
        message: "Choose a grouping column for the board",
      });
    }

    if (view.presentation === "checklist" && !view.checkedColumnId) {
      context.addIssue({
        code: "custom",
        path: ["checkedColumnId"],
        message: "Choose a checkbox column for the checklist",
      });
    }

    if (view.columns && new Set(view.columns).size !== view.columns.length) {
      context.addIssue({
        code: "custom",
        path: ["columns"],
        message: "View columns must be unique",
      });
    }
  });
export type NativeRecordView = z.infer<typeof nativeRecordViewSchema>;

export const createNativeRecordSchema = z
  .object({
    requestId: z.guid(),
    tableRevision: z.number().int().positive(),
    values: nativeRecordValuesSchema,
  })
  .strict();
export type CreateNativeRecordInput = z.infer<typeof createNativeRecordSchema>;

export const updateNativeRecordSchema = z
  .object({
    tableRevision: z.number().int().positive(),
    expectedRevision: z.number().int().positive(),
    values: nativeRecordValuesSchema,
  })
  .strict();
export type UpdateNativeRecordInput = z.infer<typeof updateNativeRecordSchema>;

export const deleteNativeRecordSchema = updateNativeRecordSchema.omit({ values: true });
export type DeleteNativeRecordInput = z.infer<typeof deleteNativeRecordSchema>;

export const nativeRecordListResponseSchema = z.object({
  records: z.array(nativeRecordSchema),
  hasMore: z.boolean(),
  changeCursor: z.number().int().nonnegative(),
});

export const nativeRecordChangeSchema = z.object({
  triggerEligible: z.boolean(),
  sequence: z.number().int().positive(),
  tableId: z.string().min(1),
  recordId: z.string().min(1),
  revision: z.number().int().positive(),
  operation: z.enum(["created", "updated", "deleted"]),
  changedByUserId: z.number().int().positive(),
  record: nativeRecordSchema,
  createdAt: z.string(),
});
export type NativeRecordChange = z.infer<typeof nativeRecordChangeSchema>;

export const nativeRecordChangesResponseSchema = z.object({
  changes: z.array(nativeRecordChangeSchema),
  nextCursor: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});

export const nativeRecordChangesQuerySchema = z.object({
  after: z.coerce.number().int().nonnegative().default(0),
});

export const readNativeRecordsInputSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("list_tables"),
      projectId: z.string().min(1).optional(),
      offset: z.number().int().min(0).default(0),
    })
    .strict(),
  z.object({ action: z.literal("get_table"), tableId: z.string().min(1) }).strict(),
  z
    .object({
      action: z.literal("query"),
      tableId: z.string().min(1),
      query: nativeRecordQuerySchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("get_record"),
      tableId: z.string().min(1),
      recordId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      action: z.literal("changes"),
      tableId: z.string().min(1),
      after: z.number().int().nonnegative().default(0),
    })
    .strict(),
]);
export type ReadNativeRecordsInput = z.infer<typeof readNativeRecordsInputSchema>;

export const writeNativeRecordsInputSchema = z.discriminatedUnion("action", [
  createNativeRecordTableSchema.extend({ action: z.literal("create_table") }),
  updateNativeRecordTableSchema.extend({
    action: z.literal("update_table"),
    tableId: z.string().min(1),
  }),
  createNativeRecordSchema.extend({
    action: z.literal("create_record"),
    tableId: z.string().min(1),
  }),
  updateNativeRecordSchema.extend({
    action: z.literal("update_record"),
    tableId: z.string().min(1),
    recordId: z.string().min(1),
  }),
  deleteNativeRecordSchema.extend({
    action: z.literal("delete_record"),
    tableId: z.string().min(1),
    recordId: z.string().min(1),
  }),
]);
export type WriteNativeRecordsInput = z.infer<typeof writeNativeRecordsInputSchema>;
