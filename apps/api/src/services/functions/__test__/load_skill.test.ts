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

  it("activates document search with the document research instructions", async () => {
    const result = await load_skill.execute({ skill: "document-research" }, {
      request: {},
    } as never);

    expect(result.status).toBe("success");
    expect(result.content).toContain('<skill_content name="document-research">');
    expect(result.data).toMatchObject({
      skill: "document-research",
      activatedTools: ["search_documents"],
    });
  });
});
