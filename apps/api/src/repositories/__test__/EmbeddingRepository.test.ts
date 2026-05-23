import { describe, expect, it, vi } from "vitest";

import { EmbeddingRepository } from "../EmbeddingRepository";

describe("EmbeddingRepository", () => {
	it("falls back to namespace-scoped legacy rows before fully unscoped rows", async () => {
		const first = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
			id: "embedding-1",
			namespace: "user_kb_42",
			user_id: null,
		});
		const bind = vi.fn((..._values: unknown[]) => ({ first }));
		const prepare = vi.fn((_query: string) => ({ bind }));

		const repository = new EmbeddingRepository({
			DB: { prepare },
		} as any);

		const result = await repository.getEmbedding("embedding-1", {
			type: "note",
			namespace: "user_kb_42",
			userId: 42,
			allowUnscopedFallback: true,
		});

		expect(result).toEqual({
			id: "embedding-1",
			namespace: "user_kb_42",
			user_id: null,
		});
		expect(prepare).toHaveBeenCalledTimes(2);
		expect(prepare.mock.calls[1][0]).toContain("namespace = ?");
		expect(prepare.mock.calls[1][0]).toContain("user_id IS NULL");
		expect(bind.mock.calls[1]).toEqual(["embedding-1", "note", "user_kb_42"]);
	});
});
