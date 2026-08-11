import type {
	CreateOutputInput,
	Output,
	OutputRevision,
	OutputShare,
	OutputSummary,
	UpdateOutputInput,
} from "@assistant/schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type {
	OutputRecord,
	OutputRevisionRecord,
	OutputShareRecord,
} from "~/repositories/OutputRepository";
import { requireProjectAccess } from "~/services/workspaces/access";
import { recordProjectAudit } from "~/services/audit";
import { sha256Hex } from "~/utils/crypto";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId, randomHex } from "~/utils/id";
import { safeParseJson } from "~/utils/json";

function parseContent(value: string): Record<string, unknown> {
	return safeParseJson<Record<string, unknown>>(value) ?? {};
}

function formatFile(record: OutputRecord): Output["file"] {
	if (!record.storage_key || !record.mime_type) return null;
	return {
		key: record.storage_key,
		mimeType: record.mime_type,
		filename: record.filename,
		byteSize: record.byte_size,
	};
}

export function formatOutput(record: OutputRecord): Output {
	return {
		id: record.id,
		createdByUserId: record.created_by_user_id,
		projectId: record.project_id,
		conversationId: record.conversation_id,
		parentOutputId: record.parent_output_id,
		capabilityId: record.capability_id,
		groupId: record.group_id,
		kind: record.kind,
		title: record.title,
		status: record.status,
		sensitivity: record.sensitivity,
		content: parseContent(record.content),
		file: formatFile(record),
		revision: record.revision,
		createdAt: record.created_at,
		updatedAt: record.updated_at,
	};
}

function formatOutputSummary(record: OutputRecord): OutputSummary {
	const { content: _content, ...summary } = formatOutput(record);
	return summary;
}

function formatRevision(record: OutputRevisionRecord): OutputRevision {
	return {
		outputId: record.output_id,
		revision: record.revision,
		title: record.title,
		status: record.status,
		sensitivity: record.sensitivity,
		content: parseContent(record.content),
		createdByUserId: record.created_by_user_id,
		createdAt: record.created_at,
	};
}

function formatShare(record: OutputShareRecord): OutputShare {
	return {
		id: record.id,
		outputId: record.output_id,
		permission: record.permission,
		expiresAt: record.expires_at,
		revokedAt: record.revoked_at,
		createdAt: record.created_at,
	};
}

async function requireConversationScope(
	context: ServiceContext,
	userId: number,
	conversationId: string,
	projectId?: string | null,
): Promise<void> {
	const conversation = await context.repositories.conversations.getConversation(conversationId);
	if (!conversation) {
		throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND, 404);
	}
	if (projectId) {
		if (conversation.project_id !== projectId) {
			throw new AssistantError("Conversation is outside this project", ErrorType.PARAMS_ERROR, 400);
		}
		return;
	}
	if (conversation.project_id !== null || conversation.user_id !== userId) {
		throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND, 404);
	}
}

async function requireOutputAccess(
	context: ServiceContext,
	userId: number,
	outputId: string,
	mutate = false,
): Promise<OutputRecord> {
	const output = await context.repositories.outputs.getOutput(outputId);
	if (!output) throw new AssistantError("Output not found", ErrorType.NOT_FOUND, 404);
	if (!output.project_id) {
		if (output.created_by_user_id !== userId) {
			throw new AssistantError("Output not found", ErrorType.NOT_FOUND, 404);
		}
		return output;
	}

	const { role } = await requireProjectAccess(context, output.project_id);
	if (mutate && role === "member" && output.created_by_user_id !== userId) {
		throw new AssistantError(
			"Only the output creator or a project admin can change it",
			ErrorType.FORBIDDEN,
			403,
		);
	}
	return output;
}

export async function createOutput(
	context: ServiceContext,
	userId: number,
	input: CreateOutputInput,
): Promise<Output> {
	if (input.projectId) await requireProjectAccess(context, input.projectId);
	if (input.conversationId) {
		await requireConversationScope(context, userId, input.conversationId, input.projectId);
	}
	if (input.parentOutputId) {
		const parent = await requireOutputAccess(context, userId, input.parentOutputId);
		if (parent.project_id !== (input.projectId ?? null)) {
			throw new AssistantError("Parent output is outside this scope", ErrorType.PARAMS_ERROR, 400);
		}
	}

	const created = await context.repositories.outputs.createOutput({
		createdByUserId: userId,
		projectId: input.projectId,
		conversationId: input.conversationId,
		parentOutputId: input.parentOutputId,
		capabilityId: input.capabilityId,
		groupId: input.groupId,
		kind: input.kind,
		title: input.title,
		status: input.status,
		sensitivity: input.sensitivity,
		content: input.content,
		storageKey: input.file?.key,
		mimeType: input.file?.mimeType,
		filename: input.file?.filename,
		byteSize: input.file?.byteSize,
	});
	if (created.project_id) {
		await recordProjectAudit(context, created.project_id, {
			actorUserId: userId,
			action: "output.created",
			targetType: "output",
			targetId: created.id,
			metadata: { capabilityId: created.capability_id, kind: created.kind },
		});
	}
	return formatOutput(created);
}

export async function getOutput(
	context: ServiceContext,
	userId: number,
	outputId: string,
): Promise<Output> {
	return formatOutput(await requireOutputAccess(context, userId, outputId));
}

export async function listOutputs(
	context: ServiceContext,
	userId: number,
	filters: { projectId?: string; capabilityId?: string; kind?: string },
): Promise<{ outputs: OutputSummary[] }> {
	const records = filters.projectId
		? (await requireProjectAccess(context, filters.projectId),
			await context.repositories.outputs.listProjectOutputs(
				filters.projectId,
				filters.capabilityId,
			))
		: await context.repositories.outputs.listPersonalOutputs(userId, filters.capabilityId);
	return {
		outputs: records
			.filter((record) => !filters.kind || record.kind === filters.kind)
			.map(formatOutputSummary),
	};
}

export async function updateOutput(
	context: ServiceContext,
	userId: number,
	outputId: string,
	input: UpdateOutputInput,
): Promise<Output> {
	const existing = await requireOutputAccess(context, userId, outputId, true);
	const updated = await context.repositories.outputs.updateOutput(outputId, {
		...input,
		updatedByUserId: userId,
	});
	if (existing.project_id) {
		await recordProjectAudit(context, existing.project_id, {
			actorUserId: userId,
			action: "output.updated",
			targetType: "output",
			targetId: outputId,
			metadata: { revision: updated.revision },
		});
	}
	return formatOutput(updated);
}

export async function deleteOutput(
	context: ServiceContext,
	userId: number,
	outputId: string,
): Promise<void> {
	const existing = await requireOutputAccess(context, userId, outputId, true);
	await context.repositories.outputs.deleteOutput(outputId);
	if (existing.project_id) {
		await recordProjectAudit(context, existing.project_id, {
			actorUserId: userId,
			action: "output.deleted",
			targetType: "output",
			targetId: outputId,
		});
	}
}

export async function listOutputRevisions(
	context: ServiceContext,
	userId: number,
	outputId: string,
): Promise<{ revisions: OutputRevision[] }> {
	await requireOutputAccess(context, userId, outputId);
	return {
		revisions: (await context.repositories.outputs.listRevisions(outputId)).map(formatRevision),
	};
}

export async function createOutputShare(
	context: ServiceContext,
	userId: number,
	outputId: string,
	expiresAt?: string | null,
): Promise<{ share: OutputShare; token: string }> {
	const output = await requireOutputAccess(context, userId, outputId, true);
	const token = randomHex(32);
	const share = await context.repositories.outputs.createShare({
		id: generateId(),
		outputId,
		tokenHash: await sha256Hex(token),
		createdByUserId: userId,
		expiresAt,
	});
	if (output.project_id) {
		await recordProjectAudit(context, output.project_id, {
			actorUserId: userId,
			action: "output.share.created",
			targetType: "output_share",
			targetId: share.id,
			metadata: { outputId, expiresAt: expiresAt ?? null },
		});
	}
	return { share: formatShare(share), token };
}

export async function listOutputShares(
	context: ServiceContext,
	userId: number,
	outputId: string,
): Promise<{ shares: OutputShare[] }> {
	await requireOutputAccess(context, userId, outputId, true);
	const now = Date.now();
	const shares = (await context.repositories.outputs.listShares(outputId)).filter(
		(share) =>
			!share.revoked_at && (!share.expires_at || new Date(share.expires_at).getTime() > now),
	);
	return { shares: shares.map(formatShare) };
}

export async function revokeOutputShare(
	context: ServiceContext,
	userId: number,
	outputId: string,
	shareId: string,
): Promise<void> {
	const output = await requireOutputAccess(context, userId, outputId, true);
	await context.repositories.outputs.revokeShare(outputId, shareId);
	if (output.project_id) {
		await recordProjectAudit(context, output.project_id, {
			actorUserId: userId,
			action: "output.share.revoked",
			targetType: "output_share",
			targetId: shareId,
			metadata: { outputId },
		});
	}
}

export async function getSharedOutput(context: ServiceContext, token: string): Promise<Output> {
	return formatOutput(await getSharedOutputRecord(context, token));
}

export async function getSharedOutputRecord(
	context: ServiceContext,
	token: string,
): Promise<OutputRecord> {
	const share = await context.repositories.outputs.getShareByTokenHash(await sha256Hex(token));
	if (
		!share ||
		share.revoked_at ||
		(share.expires_at && new Date(share.expires_at).getTime() <= Date.now())
	) {
		throw new AssistantError("Shared output not found", ErrorType.NOT_FOUND, 404);
	}
	const output = await context.repositories.outputs.getOutput(share.output_id);
	if (!output || output.status === "archived") {
		throw new AssistantError("Shared output not found", ErrorType.NOT_FOUND, 404);
	}
	return output;
}
