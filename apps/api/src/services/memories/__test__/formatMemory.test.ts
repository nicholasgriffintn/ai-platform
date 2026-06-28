import { describe, expect, it } from "vitest";
import { formatMemoryListItem } from "../formatMemory";

describe("formatMemoryListItem", () => {
	it("exposes provenance, scope, and lifecycle fields from memory records", () => {
		expect(
			formatMemoryListItem(
				{
					id: "memory-1",
					text: "User prefers concise answers.",
					category: "preference",
					created_at: "2026-06-28T10:00:00.000Z",
					updated_at: "2026-06-28T11:00:00.000Z",
					conversation_id: "conversation-1",
					namespace: "global",
					importance_score: 8,
					last_accessed: "2026-06-28T12:00:00.000Z",
					is_active: true,
					metadata: JSON.stringify({
						provider: "built-in",
						source: "store_memory",
						scope: "user",
						expiresAt: "2026-07-28T10:00:00.000Z",
						connectorProvider: "posthog",
					}),
				},
				{ groupId: "group-1", groupTitle: "Preferences" },
			),
		).toMatchObject({
			id: "memory-1",
			group_id: "group-1",
			group_title: "Preferences",
			provenance: {
				provider: "built-in",
				source: "store_memory",
				connector_provider: "posthog",
				conversation_id: "conversation-1",
			},
			scope: "user",
			namespace: "global",
			ttl: {
				expires_at: "2026-07-28T10:00:00.000Z",
			},
			lifecycle: {
				is_active: true,
				importance_score: 8,
				last_accessed: "2026-06-28T12:00:00.000Z",
				updated_at: "2026-06-28T11:00:00.000Z",
			},
		});
	});
});
