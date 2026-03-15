import { type Context, type Hono } from "hono";
import { validator as zValidator } from "hono-openapi";
import {
	requestRunApprovalSchema,
	resolveRunApprovalSchema,
	type RequestRunApprovalPayload,
	type ResolveRunApprovalPayload,
} from "@assistant/schemas";

import { getServiceContext } from "~/lib/context/serviceContext";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import {
	getSandboxRunApprovalForUser,
	listSandboxRunApprovalsForUser,
	requestSandboxRunApproval,
	resolveSandboxRunApproval,
} from "~/services/apps/sandbox/runs";
import type { IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export function registerSandboxRunApprovalRoutes(app: Hono): void {
	app.get("/runs/:runId/approvals", async (c: Context) => {
		const user = c.get("user") as IUser;
		const runId = c.req.param("runId");
		if (!runId) {
			throw new AssistantError("runId is required", ErrorType.PARAMS_ERROR);
		}
		const approvals = await listSandboxRunApprovalsForUser({
			context: getServiceContext(c),
			userId: user.id,
			runId,
		});
		return ResponseFactory.success(c, { approvals });
	});

	app.get("/runs/:runId/approvals/:approvalId", async (c: Context) => {
		const user = c.get("user") as IUser;
		const runId = c.req.param("runId");
		const approvalId = c.req.param("approvalId");
		if (!runId || !approvalId) {
			throw new AssistantError(
				"runId and approvalId are required",
				ErrorType.PARAMS_ERROR,
			);
		}
		const approval = await getSandboxRunApprovalForUser({
			context: getServiceContext(c),
			userId: user.id,
			runId,
			approvalId,
		});
		return ResponseFactory.success(c, { approval });
	});

	app.post(
		"/runs/:runId/approvals/request",
		zValidator("json", requestRunApprovalSchema),
		async (c: Context) => {
			const user = c.get("user") as IUser;
			const runId = c.req.param("runId");
			if (!runId) {
				throw new AssistantError("runId is required", ErrorType.PARAMS_ERROR);
			}
			const payload = c.req.valid("json" as never) as RequestRunApprovalPayload;
			const approval = await requestSandboxRunApproval({
				context: getServiceContext(c),
				userId: user.id,
				runId,
				command: payload.command,
				reason: payload.reason,
				timeoutSeconds: payload.timeoutSeconds,
				escalateAfterSeconds: payload.escalateAfterSeconds,
			});
			return ResponseFactory.success(c, { approval });
		},
	);

	app.post(
		"/runs/:runId/approvals/:approvalId/resolve",
		zValidator("json", resolveRunApprovalSchema),
		async (c: Context) => {
			const user = c.get("user") as IUser;
			const runId = c.req.param("runId");
			const approvalId = c.req.param("approvalId");
			if (!runId || !approvalId) {
				throw new AssistantError(
					"runId and approvalId are required",
					ErrorType.PARAMS_ERROR,
				);
			}
			const payload = c.req.valid("json" as never) as ResolveRunApprovalPayload;
			const result = await resolveSandboxRunApproval({
				context: getServiceContext(c),
				userId: user.id,
				runId,
				approvalId,
				status: payload.status,
				reason: payload.reason,
			});
			return ResponseFactory.success(c, result);
		},
	);
}
