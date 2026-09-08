import { describe, expect, it } from "vitest";

import { createFakeForgeAdapter } from ".";

describe("forge adapter seam", () => {
  it("lets a review surface use a forge without knowing its transport", async () => {
    const adapter = createFakeForgeAdapter();

    await expect(
      adapter.createPullRequest({
        repository: "example/repository",
        head: "polychat/run-1",
        base: "main",
        title: "Reviewed change",
        body: "Validation passed",
      }),
    ).resolves.toMatchObject({
      ref: { forge: "github", number: 1 },
      url: "https://github.com/example/repository/pull/1",
    });
  });
});
