import { agentPullRequestRequestSchema } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

const changes = {
  repository: "acme/app",
  branch: "polychat/conversation-1",
  baseBranch: "main",
  baseCommit: "a".repeat(40),
  headCommit: "b".repeat(40),
  files: [{ path: "src/app.ts", deleted: false, executable: false, contentBase64: "aGVsbG8=" }],
};

describe("agent pull request requests", () => {
  it("refuses branches outside Polychat's namespace and paths that leave the repository", () => {
    const parse = (overrides: Record<string, unknown>) =>
      agentPullRequestRequestSchema.safeParse({
        title: "x",
        changes: { ...changes, ...overrides },
      }).success;

    expect(parse({})).toBe(true);
    expect(parse({ branch: "main" })).toBe(false);
    expect(
      parse({
        files: [
          { path: "../etc/passwd", deleted: false, executable: false, contentBase64: "eA==" },
        ],
      }),
    ).toBe(false);
  });
});
