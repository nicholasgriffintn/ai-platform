import { describe, expect, it } from "vitest";

import { buildDryRunResponse } from "../dry-run";

describe("dry runs", () => {
  it("lets reads and drafts run for real", () => {
    expect(
      buildDryRunResponse({
        toolName: "web_search",
        effectClass: "read",
        destination: undefined,
        args: {},
      }),
    ).toBeNull();
    expect(
      buildDryRunResponse({
        toolName: "create_note",
        effectClass: "draft",
        destination: undefined,
        args: {},
      }),
    ).toBeNull();
  });

  it("turns a send into a drafted receipt without acting", () => {
    const response = buildDryRunResponse({
      toolName: "slack_send",
      effectClass: "external_send",
      destination: "#eng-checkout",
      args: { text: "Reproduced" },
    });

    expect(response?.data).toMatchObject({
      dryRun: true,
      receipt: { outcome: "drafted", destination: "#eng-checkout", effect: "external_send" },
    });
    expect(response?.content).toContain("Nothing was changed");
  });
});
