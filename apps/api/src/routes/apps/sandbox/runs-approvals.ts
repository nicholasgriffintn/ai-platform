import { type Context, type Hono } from "hono";
import { validator as zValidator } from "hono-openapi";
import {
	requestRunApprovalSchema,
	resolveRunApprovalSchema,
	sandboxRunParamsSchema,
	sandboxRunApprovalParamsSchema,
	type RequestRunApprovalPayload,
	type ResolveRunApprovalPayload,
	type SandboxRunParams,
	type SandboxRunApprovalParams,
} from "@assistant/schemas";

import { getServiceContext } from "~/lib/context/serviceContext";
import { requireAuthenticatedUser } from "~/lib/http/auth";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import {
	getSandboxRunApprovalForUser,
	listSandboxRunApprovalsForUser,
	requestSandboxRunApproval,
	resolveSandboxRunApproval,
} from "~/services/apps/sandbox/runs";

export function registerSandboxRunApprovalRoutes(app: Hono): void {
	app.get(
		"/runs/:runId/approvals",
		zValidator("param", sandboxRunParamsSchema),
		async (c: Context) => {
			const user = requireAuthenticatedUser(c);
			const { runId } = c.req.valid("param" as never) as SandboxRunParams;
			const approvals = await listSandboxRunApprovalsForUser({
				context: getServiceContext(c),
				userId: user.id,
				runId,
			});
			return ResponseFactory.success(c, { approvals });
		},
	);

	app.get(
		"/runs/:runId/approvals/:approvalId",
		zValidator("param", sandboxRunApprovalParamsSchema),
		async (c: Context) => {
			const user = requireAuthenticatedUser(c);
			const { runId, approvalId } = c.req.valid(
				"param" as never,
			) as SandboxRunApprovalParams;
			const approval = await getSandboxRunApprovalForUser({
				context: getServiceContext(c),
				userId: user.id,
				runId,
				approvalId,
			});
			return ResponseFactory.success(c, { approval });
		},
	);

	app.post(
		"/runs/:runId/approvals/request",
		zValidator("param", sandboxRunParamsSchema),
		zValidator("json", requestRunApprovalSchema),
		async (c: Context) => {
			const user = requireAuthenticatedUser(c);
			const { runId } = c.req.valid("param" as never) as SandboxRunParams;
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
		zValidator("param", sandboxRunApprovalParamsSchema),
		zValidator("json", resolveRunApprovalSchema),
		async (c: Context) => {
			const user = requireAuthenticatedUser(c);
			const { runId, approvalId } = c.req.valid(
				"param" as never,
			) as SandboxRunApprovalParams;
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
