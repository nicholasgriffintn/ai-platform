import { describe, expect, it } from "vitest";

import { deriveQualityGateCommands } from "../feature-implementation/quality-gate";

describe("quality gate helpers", () => {
  it("derives only safe validation commands from plans", () => {
    const commands = deriveQualityGateCommands({
      plans: [
        [
          "Validation commands:",
          "```bash",
          "pnpm lint",
          "pnpm typecheck",
          "pnpm install",
          "git add .",
          "pnpm test && pnpm lint",
          "pnpm lint",
          "```",
        ].join("\n"),
      ],
    });

    expect(commands).toEqual(["pnpm lint", "pnpm typecheck"]);
  });
});
