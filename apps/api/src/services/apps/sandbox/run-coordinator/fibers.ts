import {
	sandboxRunDispatchMessageSchema,
	type SandboxRunDispatchMessage,
} from "@assistant/schemas";
import type { FiberRecoveryContext, StartFiberResult } from "agents";

import { isPlainObject } from "~/utils/objects";

export const SANDBOX_RUN_DISPATCH_FIBER_NAME = "sandbox-run-dispatch";

export interface SandboxDispatchFiberSnapshot {
	message: SandboxRunDispatchMessage;
	phase: "running" | "completed" | "error";
	updatedAt: string;
	error?: string;
}

export function parseSandboxDispatchFiberMessage(value: unknown): SandboxRunDispatchMessage | null {
	const direct = sandboxRunDispatchMessageSchema.safeParse(value);
	if (direct.success) {
		return direct.data;
	}

	if (!isPlainObject(value)) {
		return null;
	}

	const nested = sandboxRunDispatchMessageSchema.safeParse(value.message);
	return nested.success ? nested.data : null;
}

export function parseSandboxDispatchRecoveryMessage(
	context: FiberRecoveryContext,
): SandboxRunDispatchMessage | null {
	return (
		parseSandboxDispatchFiberMessage(context.metadata) ??
		parseSandboxDispatchFiberMessage(context.snapshot)
	);
}

export function isStartFiberResult(value: unknown): value is StartFiberResult {
	if (!isPlainObject(value)) {
		return false;
	}

	return (
		typeof value.fiberId === "string" &&
		typeof value.name === "string" &&
		typeof value.status === "string" &&
		typeof value.accepted === "boolean" &&
		typeof value.createdAt === "number"
	);
}
