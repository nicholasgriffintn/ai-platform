import type { Memory } from "~/lib/database/schema";
import { safeParseJson } from "~/utils/json";
import { isRecord } from "~/utils/objects";
import { readStringFieldAlias } from "~/utils/recordFields";

interface MemoryGroupInfo {
	groupId: string;
	groupTitle: string;
}

function readMetadata(
	memory: Pick<Memory, "metadata"> | { metadata?: unknown },
): Record<string, unknown> {
	if (isRecord(memory.metadata)) {
		return memory.metadata;
	}

	if (typeof memory.metadata !== "string" || !memory.metadata.trim()) {
		return {};
	}

	const parsed = safeParseJson(memory.metadata);
	return isRecord(parsed) ? parsed : {};
}

export function formatMemoryListItem(
	memory: Pick<
		Memory,
		| "id"
		| "text"
		| "category"
		| "created_at"
		| "updated_at"
		| "conversation_id"
		| "metadata"
		| "namespace"
		| "importance_score"
		| "last_accessed"
		| "is_active"
	>,
	groupInfo?: MemoryGroupInfo,
) {
	const metadata = readMetadata(memory);
	const scope = readStringFieldAlias(metadata, ["scope", "memoryScope"]) ?? "user";
	const expiresAt = readStringFieldAlias(metadata, ["expiresAt", "expires_at"]);
	const provider = readStringFieldAlias(metadata, ["provider", "memoryProvider"]) ?? "built-in";
	const source = readStringFieldAlias(metadata, ["source", "origin"]) ?? "unknown";
	const connectorProvider = readStringFieldAlias(metadata, [
		"connectorProvider",
		"connector_provider",
	]);

	return {
		id: memory.id,
		text: memory.text,
		category: memory.category,
		created_at: memory.created_at,
		group_id: groupInfo?.groupId || null,
		group_title: groupInfo?.groupTitle || null,
		provenance: {
			provider,
			source,
			conversation_id: memory.conversation_id,
			...(connectorProvider ? { connector_provider: connectorProvider } : {}),
		},
		scope,
		namespace: memory.namespace ?? "global",
		ttl: {
			expires_at: expiresAt ?? null,
		},
		lifecycle: {
			is_active: memory.is_active ?? true,
			importance_score: memory.importance_score ?? 5,
			last_accessed: memory.last_accessed,
			updated_at: memory.updated_at,
		},
	};
}
