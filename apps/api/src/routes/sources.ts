import { Hono } from "hono";
import z from "zod/v4";
import {
	addCollectionSourcesSchema,
	createSourceCollectionSchema,
	createSourceSchema,
	sourceCollectionListResponseSchema,
	sourceCollectionSchema,
	sourceListQuerySchema,
	sourceListResponseSchema,
	sourceSchema,
	setProjectContextSourcesSchema,
	updateSourceSchema,
} from "@assistant/schemas";

import { addRoute } from "~/lib/http/routeBuilder";
import {
	addCollectionSources,
	createSource,
	createSourceCollection,
	deleteSource,
	deleteSourceCollection,
	getSource,
	listCollectionSources,
	listProjectContextSources,
	listSourceCollections,
	listSources,
	setProjectContextSources,
	updateSource,
} from "~/services/sources";
import { getPrivateFileResponse, readPrivateFile } from "~/lib/storage/read-resource";

const app = new Hono();
const sourceParams = z.object({ sourceId: z.string().min(1) });
const collectionParams = z.object({ collectionId: z.string().min(1) });
const projectQuery = z.object({ projectId: z.string().min(1).optional() });
const requiredProjectQuery = z.object({ projectId: z.string().min(1) });
const createSourceRequestSchema = createSourceSchema.omit({ file: true });

addRoute(app, "get", "/:sourceId/content", {
	tags: ["sources"],
	paramSchema: sourceParams,
	responses: { 200: { description: "Source file" } },
	handler: async ({ params, serviceContext, user }) => {
		const file = await readPrivateFile({
			context: serviceContext,
			kind: "source",
			resourceId: params.sourceId,
			userId: user?.id,
		});
		return await getPrivateFileResponse(file.record, file.object);
	},
});

addRoute(app, "get", "/", {
	tags: ["sources"],
	auth: true,
	querySchema: sourceListQuerySchema,
	responses: { 200: { description: "Sources", schema: sourceListResponseSchema } },
	handler: ({ query, serviceContext, user }) => listSources(serviceContext, user.id, query),
});

addRoute(app, "post", "/", {
	tags: ["sources"],
	auth: true,
	bodySchema: createSourceRequestSchema,
	responses: { 200: { description: "Created source", schema: sourceSchema } },
	handler: ({ body, serviceContext, user }) => createSource(serviceContext, user.id, body),
});

addRoute(app, "get", "/collections", {
	tags: ["sources"],
	auth: true,
	querySchema: projectQuery,
	responses: {
		200: { description: "Source collections", schema: sourceCollectionListResponseSchema },
	},
	handler: ({ query, serviceContext, user }) =>
		listSourceCollections(serviceContext, user.id, query.projectId),
});

addRoute(app, "post", "/collections", {
	tags: ["sources"],
	auth: true,
	bodySchema: createSourceCollectionSchema,
	responses: { 200: { description: "Created collection", schema: sourceCollectionSchema } },
	handler: ({ body, serviceContext, user }) =>
		createSourceCollection(serviceContext, user.id, body),
});

addRoute(app, "get", "/collections/:collectionId/sources", {
	tags: ["sources"],
	auth: true,
	paramSchema: collectionParams,
	responses: { 200: { description: "Collection sources", schema: sourceListResponseSchema } },
	handler: ({ params, serviceContext, user }) =>
		listCollectionSources(serviceContext, user.id, params.collectionId),
});

addRoute(app, "post", "/collections/:collectionId/sources", {
	tags: ["sources"],
	auth: true,
	paramSchema: collectionParams,
	bodySchema: addCollectionSourcesSchema,
	responses: {
		200: {
			description: "Sources added",
			schema: z.object({ added: z.number().int().nonnegative() }),
		},
	},
	handler: ({ body, params, serviceContext, user }) =>
		addCollectionSources(serviceContext, user.id, params.collectionId, body.sourceIds),
});

addRoute(app, "get", "/project-context", {
	tags: ["sources"],
	auth: true,
	querySchema: requiredProjectQuery,
	responses: { 200: { description: "Project context sources", schema: sourceListResponseSchema } },
	handler: ({ query, serviceContext, user }) =>
		listProjectContextSources(serviceContext, user.id, query.projectId),
});

addRoute(app, "put", "/project-context", {
	tags: ["sources"],
	auth: true,
	querySchema: requiredProjectQuery,
	bodySchema: setProjectContextSourcesSchema,
	responses: { 200: { description: "Project context sources", schema: sourceListResponseSchema } },
	handler: ({ body, query, serviceContext, user }) =>
		setProjectContextSources(serviceContext, user.id, query.projectId, body.sourceIds),
});

addRoute(app, "delete", "/collections/:collectionId", {
	tags: ["sources"],
	auth: true,
	paramSchema: collectionParams,
	responses: {
		200: { description: "Deleted collection", schema: z.object({ success: z.literal(true) }) },
	},
	handler: async ({ params, serviceContext, user }) => {
		await deleteSourceCollection(serviceContext, user.id, params.collectionId);
		return { success: true as const };
	},
});

addRoute(app, "get", "/:sourceId", {
	tags: ["sources"],
	auth: true,
	paramSchema: sourceParams,
	responses: { 200: { description: "Source", schema: sourceSchema } },
	handler: ({ params, serviceContext, user }) =>
		getSource(serviceContext, user.id, params.sourceId),
});

addRoute(app, "put", "/:sourceId", {
	tags: ["sources"],
	auth: true,
	paramSchema: sourceParams,
	bodySchema: updateSourceSchema,
	responses: { 200: { description: "Updated source", schema: sourceSchema } },
	handler: ({ body, params, serviceContext, user }) =>
		updateSource(serviceContext, user.id, params.sourceId, body),
});

addRoute(app, "delete", "/:sourceId", {
	tags: ["sources"],
	auth: true,
	paramSchema: sourceParams,
	responses: {
		200: { description: "Deleted source", schema: z.object({ success: z.literal(true) }) },
	},
	handler: async ({ params, serviceContext, user }) => {
		await deleteSource(serviceContext, user.id, params.sourceId);
		return { success: true as const };
	},
});

export default app;
