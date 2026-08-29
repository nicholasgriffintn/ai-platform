import { beforeEach, describe, expect, it, vi } from "vitest";

import { listPatterns } from "../list";
import { PATTERN_OUTPUT_KIND, STRUDEL_APP_ID } from "../utils";

const listPersonalOutputs = vi.fn();
const listProjectOutputs = vi.fn();

function createContext() {
  return {
    ensureDatabase: vi.fn(),
    repositories: { outputs: { listPersonalOutputs, listProjectOutputs } },
  } as any;
}

describe("listPatterns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listPersonalOutputs.mockResolvedValue([]);
    listProjectOutputs.mockResolvedValue([]);
  });

  it("lists only saved patterns personally", async () => {
    await listPatterns({ context: createContext(), userId: 42 });

    expect(listPersonalOutputs).toHaveBeenCalledWith(42, STRUDEL_APP_ID, {
      kind: PATTERN_OUTPUT_KIND,
    });
  });

  it("lists only saved patterns in a project", async () => {
    await listPatterns({ context: createContext(), userId: 42, projectId: "project-1" });

    expect(listProjectOutputs).toHaveBeenCalledWith("project-1", STRUDEL_APP_ID, {
      kind: PATTERN_OUTPUT_KIND,
    });
  });
});
