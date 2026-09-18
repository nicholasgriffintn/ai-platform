import { describe, expect, it, vi } from "vitest";

import type { IEnv } from "~/types";

import { SourceRepository } from "../SourceRepository";

function createRepository() {
  const all = vi.fn().mockResolvedValue({ results: [] });
  const first = vi.fn().mockResolvedValue(null);
  const run = vi.fn().mockResolvedValue({ success: true });
  const bind = vi.fn().mockReturnValue({ all, first, run });
  const prepare = vi.fn().mockReturnValue({ bind, all, first, run });

  const repository = new SourceRepository({
    DB: { prepare, batch: vi.fn() },
  } as unknown as IEnv);

  return { prepare, repository };
}

describe("SourceRepository", () => {
  it("leaves the extracted body text out of source listings", async () => {
    const { prepare, repository } = createRepository();

    await repository.listPersonalSourceSummaries(1);

    const query = prepare.mock.calls[0][0] as string;

    expect(query).not.toContain("content");
    expect(query).toContain("title");
    expect(query).toContain("storage_key");
  });

  it("still reads the body text when a caller asks for whole records", async () => {
    const { prepare, repository } = createRepository();

    await repository.listPersonalSources(1, "memory");

    expect(prepare.mock.calls[0][0] as string).toContain("*");
  });
});
