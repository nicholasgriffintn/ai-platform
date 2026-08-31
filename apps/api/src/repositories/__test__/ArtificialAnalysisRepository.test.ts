import { describe, expect, it, vi } from "vitest";

import type { ArtificialAnalysisModelRecord } from "~/lib/artificial-analysis/types";

import { ArtificialAnalysisRepository } from "../ArtificialAnalysisRepository";

function createRepository() {
  const bind = vi.fn().mockImplementation((...values: unknown[]) => ({ values }));
  const prepare = vi.fn().mockImplementation((query: string) => ({ query, bind }));
  const batch = vi.fn().mockResolvedValue([]);
  const run = vi.fn().mockResolvedValue({ success: true });

  const repository = new ArtificialAnalysisRepository({
    DB: {
      batch,
      prepare,
      run,
    },
  } as any);

  return { batch, bind, prepare, repository, run };
}

function createRecord(id: string): ArtificialAnalysisModelRecord {
  return {
    id,
    name: `Model ${id}`,
    slug: `model-${id}`,
    evaluations: { intelligence: 42 },
    pricing: { input: 1 },
    intelligence_index: 42,
    source: "artificial_analysis",
    source_url: "https://artificialanalysis.ai/",
    ingested_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("ArtificialAnalysisRepository", () => {
  it("upserts every record in batches while preserving conflict semantics", async () => {
    const { batch, prepare, repository } = createRepository();
    const records = Array.from({ length: 120 }, (_, index) => createRecord(`model-${index}`));

    const stored = await repository.upsertMany(records);

    expect(stored).toBe(120);
    expect(batch).toHaveBeenCalledTimes(3);

    const statementCounts = batch.mock.calls.map((call) => call[0].length);

    expect(statementCounts).toEqual([50, 50, 20]);
    expect(prepare).toHaveBeenCalledTimes(120);

    const query = prepare.mock.calls[0][0];

    expect(query).toContain("ON CONFLICT(id) DO UPDATE SET");
    expect(query).toContain("name = excluded.name");
    expect(query).toContain("derived_strengths = NULL");
    expect(query).toContain("derived_scores = NULL");
    expect(query).toContain("updated_at = datetime('now')");
  });

  it("binds record values in the order the upsert columns declare", async () => {
    const { bind, repository } = createRepository();
    const record = createRecord("model-a");

    await repository.upsertMany([record]);

    expect(bind).toHaveBeenCalledTimes(1);
    expect(bind.mock.calls[0]).toEqual([
      "model-a",
      "Model model-a",
      "model-model-a",
      null,
      null,
      null,
      JSON.stringify(record.evaluations),
      JSON.stringify(record.pricing),
      42,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "artificial_analysis",
      "https://artificialanalysis.ai/",
      "2026-01-01T00:00:00.000Z",
    ]);
  });

  it("does not touch the database when there is nothing to store", async () => {
    const { batch, prepare, repository } = createRepository();

    await expect(repository.upsertMany([])).resolves.toBe(0);

    expect(batch).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
  });
});
