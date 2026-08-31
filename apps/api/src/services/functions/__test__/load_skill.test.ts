import { describe, expect, it } from "vitest";

import { load_skill } from "../load_skill";

describe("load_skill", () => {
  it("loads the primary instructions when the model names SKILL.md explicitly", async () => {
    const result = await load_skill.execute({ skill: "artifacts", resource: "SKILL.md" }, {
      request: {},
    } as never);

    expect(result.status).toBe("success");
    expect(result.content).toContain('<skill_content name="artifacts">');
  });
});
