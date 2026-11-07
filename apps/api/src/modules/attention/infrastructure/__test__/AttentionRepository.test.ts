import { describe, expect, it, vi } from "vitest";

import type { IEnv } from "~/types";

import { AttentionRepository } from "../AttentionRepository";

function repositoryReturning(responses: { all?: unknown[][]; first?: unknown }) {
  const all = vi.fn();

  for (const results of responses.all ?? []) {
    all.mockResolvedValueOnce({ results, meta: {} });
  }

  const first = vi.fn().mockResolvedValue(responses.first ?? null);
  const prepare = vi.fn(() => ({ bind: () => ({ all, first }) }));
  const env: IEnv = Object.assign(Object.create(null), {
    DB: Object.assign(Object.create(null), { prepare }),
  });

  return { repository: new AttentionRepository(env), prepare };
}

describe("AttentionRepository", () => {
  it("keeps the filtered total when a cursor page comes back empty", async () => {
    const { repository, prepare } = repositoryReturning({ all: [[]], first: { total: 12 } });

    await expect(repository.list(7, { limit: 20, after: "task:gone" })).resolves.toEqual({
      items: [],
      total: 12,
    });
    expect(prepare).toHaveBeenCalledTimes(2);
  });

  it("reads the page and its total in one query", async () => {
    const { repository, prepare } = repositoryReturning({ all: [[]] });

    await expect(repository.list(7, { limit: 20 })).resolves.toEqual({ items: [], total: 0 });
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it("derives distinct, name-ordered facets from one query", async () => {
    const row = (
      workspace: [string, string],
      project: [string, string],
      owner: [number, string],
    ) => ({
      workspace_id: workspace[0],
      workspace_name: workspace[1],
      project_id: project[0],
      project_name: project[1],
      owner_user_id: owner[0],
      owner_name: owner[1],
    });
    const { repository, prepare } = repositoryReturning({
      all: [
        [
          row(["w2", "Zeta"], ["p2", "Beta"], [2, "Sam"]),
          row(["w1", "Alpha"], ["p1", "Apollo"], [2, "Sam"]),
          row(["w1", "Alpha"], ["p1", "Apollo"], [10, "Sam"]),
          row(["w1", "Alpha"], ["p3", "Beta"], [1, "Ann"]),
        ],
      ],
    });

    await expect(repository.listFacets(7)).resolves.toEqual({
      workspaces: [
        { id: "w1", name: "Alpha" },
        { id: "w2", name: "Zeta" },
      ],
      projects: [
        { id: "p1", workspaceId: "w1", name: "Apollo" },
        { id: "p2", workspaceId: "w2", name: "Beta" },
        { id: "p3", workspaceId: "w1", name: "Beta" },
      ],
      owners: [
        { id: 1, name: "Ann" },
        { id: 2, name: "Sam" },
        { id: 10, name: "Sam" },
      ],
    });
    expect(prepare).toHaveBeenCalledTimes(1);
  });
});
