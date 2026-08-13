import { Hono } from "hono";
import z from "zod/v4";
import {
	createOutputSchema,
	createOutputShareSchema,
	errorResponseSchema,
	outputListQuerySchema,
	outputListResponseSchema,
	outputRevisionSchema,
	outputSchema,
	outputShareDeliverySchema,
	outputShareListResponseSchema,
	sharedOutputSchema,
	updateOutputSchema,
} from "@ngriffin_uk/polychat-schemas";

import { addRoute } from "~/lib/http/routeBuilder";
import {
	createOutput,
	createOutputShare,
	deleteOutput,
	getOutput,
	getSharedOutput,
	getSharedOutputRecord,
	listOutputShares,
	listOutputRevisions,
	listOutputs,
	revokeOutputShare,
	updateOutput,
} from "~/services/outputs";
import { getPrivateFileResponse, readPrivateFile } from "~/lib/storage/read-resource";
import { StorageService } from "~/lib/storage";
import { AssistantError, ErrorType } from "~/utils/errors";

const app = new Hono();
const outputParams = z.object({ outputId: z.string().min(1) });
const shareParams = outputParams.extend({ shareId: z.string().min(1) });
const sharedOutputParams = z.object({ token: z.string().min(32) });
const createOutputRequestSchema = createOutputSchema.omit({ file: true });

addRoute(app, "get", "/shared/:token/content", {
	tags: ["outputs"],
	paramSchema: sharedOutputParams,
	responses: { 200: { description: "Shared output file" } },
	handler: async ({ params, serviceContext }) => {
		const record = await getSharedOutputRecord(serviceContext, params.token);
		if (!record.storage_key || !record.mime_type) {
			throw new AssistantError("Shared output file not found", ErrorType.NOT_FOUND, 404);
		}
		const object = await new StorageService(serviceContext.env.PRIVATE_ASSETS_BUCKET).getObjectBody(
			record.storage_key,
		);
		if (!object) {
			throw new AssistantError("Shared output file not found", ErrorType.NOT_FOUND, 404);
		}
		return getPrivateFileResponse(record, object);
	},
});

addRoute(app, "get", "/:outputId/content", {
	tags: ["outputs"],
	paramSchema: outputParams,
	responses: { 200: { description: "Output file" } },
	handler: async ({ params, serviceContext, user }) => {
		const file = await readPrivateFile({
			context: serviceContext,
			kind: "output",
			resourceId: params.outputId,
			userId: user?.id,
		});
		return await getPrivateFileResponse(file.record, file.object);
	},
});

addRoute(app, "get", "/", {
	tags: ["outputs"],
	auth: true,
	querySchema: outputListQuerySchema,
	responses: { 200: { description: "Outputs", schema: outputListResponseSchema } },
	handler: ({ query, serviceContext, user }) => listOutputs(serviceContext, user.id, query),
});

addRoute(app, "post", "/", {
	tags: ["outputs"],
	auth: true,
	bodySchema: createOutputRequestSchema,
	responses: { 200: { description: "Created output", schema: outputSchema } },
	handler: ({ body, serviceContext, user }) => createOutput(serviceContext, user.id, body),
});

addRoute(app, "get", "/:outputId", {
	tags: ["outputs"],
	auth: true,
	paramSchema: outputParams,
	responses: { 200: { description: "Output", schema: outputSchema } },
	handler: ({ params, serviceContext, user }) =>
		getOutput(serviceContext, user.id, params.outputId),
});

addRoute(app, "put", "/:outputId", {
	tags: ["outputs"],
	auth: true,
	paramSchema: outputParams,
	bodySchema: updateOutputSchema,
	responses: { 200: { description: "Updated output", schema: outputSchema } },
	handler: ({ body, params, serviceContext, user }) =>
		updateOutput(serviceContext, user.id, params.outputId, body),
});

addRoute(app, "delete", "/:outputId", {
	tags: ["outputs"],
	auth: true,
	paramSchema: outputParams,
	responses: {
		200: { description: "Deleted output", schema: z.object({ success: z.literal(true) }) },
	},
	handler: async ({ params, serviceContext, user }) => {
		await deleteOutput(serviceContext, user.id, params.outputId);
		return { success: true as const };
	},
});

addRoute(app, "get", "/:outputId/revisions", {
	tags: ["outputs"],
	auth: true,
	paramSchema: outputParams,
	responses: {
		200: {
			description: "Output revisions",
			schema: z.object({ revisions: z.array(outputRevisionSchema) }),
		},
	},
	handler: ({ params, serviceContext, user }) =>
		listOutputRevisions(serviceContext, user.id, params.outputId),
});

addRoute(app, "post", "/:outputId/shares", {
	tags: ["outputs"],
	auth: true,
	paramSchema: outputParams,
	bodySchema: createOutputShareSchema,
	responses: { 200: { description: "Output share", schema: outputShareDeliverySchema } },
	handler: ({ body, params, serviceContext, user }) =>
		createOutputShare(serviceContext, user.id, params.outputId, body.expiresAt),
});

addRoute(app, "get", "/:outputId/shares", {
	tags: ["outputs"],
	auth: true,
	paramSchema: outputParams,
	responses: {
		200: { description: "Active output shares", schema: outputShareListResponseSchema },
	},
	handler: ({ params, serviceContext, user }) =>
		listOutputShares(serviceContext, user.id, params.outputId),
});

addRoute(app, "delete", "/:outputId/shares/:shareId", {
	tags: ["outputs"],
	auth: true,
	paramSchema: shareParams,
	responses: {
		200: { description: "Revoked share", schema: z.object({ success: z.literal(true) }) },
	},
	handler: async ({ params, serviceContext, user }) => {
		await revokeOutputShare(serviceContext, user.id, params.outputId, params.shareId);
		return { success: true as const };
	},
});

addRoute(app, "get", "/shared/:token", {
	tags: ["outputs"],
	paramSchema: sharedOutputParams,
	responses: {
		200: { description: "Shared output", schema: sharedOutputSchema },
		404: { description: "Shared output not found", schema: errorResponseSchema },
	},
	handler: ({ params, serviceContext }) => getSharedOutput(serviceContext, params.token),
});

export default app;
