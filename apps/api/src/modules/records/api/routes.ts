import {
  createNativeRecordTableSchema,
  updateNativeRecordTableSchema,
  nativeRecordTableResponseSchema,
  createNativeRecordSchema,
  updateNativeRecordSchema,
  deleteNativeRecordSchema,
  nativeRecordSchema,
  nativeRecordQuerySchema,
  nativeRecordListResponseSchema,
  nativeRecordChangesQuerySchema,
  nativeRecordChangesResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";

import {
  createNativeRecord,
  getNativeRecord,
  updateNativeRecord,
  deleteNativeRecord,
  listNativeRecords,
  listNativeRecordChanges,
} from "../application/records";
import {
  createNativeRecordTable,
  getNativeRecordTable,
  updateNativeRecordTable,
} from "../application/tables";

const app = new Hono();
const tableParams = z.object({ tableId: z.string().min(1) });
const recordParams = tableParams.extend({ recordId: z.string().min(1) });

addRoute(app, "post", "/", {
  tags: ["records"],
  auth: true,
  bodySchema: createNativeRecordTableSchema,
  responses: {
    200: { description: "Created record table", schema: nativeRecordTableResponseSchema },
  },
  handler: ({ serviceContext, body }) => createNativeRecordTable(serviceContext, body),
});

addRoute(app, "get", "/:tableId", {
  tags: ["records"],
  auth: true,
  paramSchema: tableParams,
  responses: {
    200: { description: "Record table and permissions", schema: nativeRecordTableResponseSchema },
  },
  handler: ({ serviceContext, params }) => getNativeRecordTable(serviceContext, params.tableId),
});

addRoute(app, "put", "/:tableId", {
  tags: ["records"],
  auth: true,
  paramSchema: tableParams,
  bodySchema: updateNativeRecordTableSchema,
  responses: {
    200: { description: "Updated table columns", schema: nativeRecordTableResponseSchema },
  },
  handler: ({ serviceContext, params, body }) =>
    updateNativeRecordTable(serviceContext, params.tableId, body),
});

addRoute(app, "post", "/:tableId/query", {
  tags: ["records"],
  auth: true,
  paramSchema: tableParams,
  bodySchema: nativeRecordQuerySchema,
  responses: { 200: { description: "Authorised records", schema: nativeRecordListResponseSchema } },
  handler: ({ serviceContext, params, body }) =>
    listNativeRecords(serviceContext, params.tableId, body),
});

addRoute(app, "get", "/:tableId/changes", {
  tags: ["records"],
  auth: true,
  paramSchema: tableParams,
  querySchema: nativeRecordChangesQuerySchema,
  responses: {
    200: { description: "Resumable authorised changes", schema: nativeRecordChangesResponseSchema },
  },
  handler: ({ serviceContext, params, query }) =>
    listNativeRecordChanges(serviceContext, params.tableId, query.after),
});

addRoute(app, "post", "/:tableId/rows", {
  tags: ["records"],
  auth: true,
  paramSchema: tableParams,
  bodySchema: createNativeRecordSchema,
  responses: { 200: { description: "Saved record", schema: nativeRecordSchema } },
  handler: ({ serviceContext, params, body }) =>
    createNativeRecord(serviceContext, params.tableId, body),
});

addRoute(app, "get", "/:tableId/rows/:recordId", {
  tags: ["records"],
  auth: true,
  paramSchema: recordParams,
  responses: { 200: { description: "Record", schema: nativeRecordSchema } },
  handler: ({ serviceContext, params }) =>
    getNativeRecord(serviceContext, params.tableId, params.recordId),
});

addRoute(app, "put", "/:tableId/rows/:recordId", {
  tags: ["records"],
  auth: true,
  paramSchema: recordParams,
  bodySchema: updateNativeRecordSchema,
  responses: { 200: { description: "Saved record revision", schema: nativeRecordSchema } },
  handler: ({ serviceContext, params, body }) =>
    updateNativeRecord(serviceContext, params.tableId, params.recordId, body),
});

addRoute(app, "delete", "/:tableId/rows/:recordId", {
  tags: ["records"],
  auth: true,
  paramSchema: recordParams,
  bodySchema: deleteNativeRecordSchema,
  responses: { 200: { description: "Deleted record tombstone", schema: nativeRecordSchema } },
  handler: ({ serviceContext, params, body }) =>
    deleteNativeRecord(serviceContext, params.tableId, params.recordId, body),
});

export default app;
