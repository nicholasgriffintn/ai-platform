import { describe, expect, it } from "vitest";

import { getRunnableTool } from "../runnable";

describe("getRunnableTool", () => {
  it("derives a form from the tool's own input schema", () => {
    const tool = getRunnableTool("get_weather");

    expect(tool).toMatchObject({
      id: "get_weather",
      name: "Get Weather",
      category: "Research",
    });

    const fields = tool?.formSchema.steps[0]?.fields ?? [];

    expect(fields.length).toBeGreaterThan(0);
    expect(fields.every((field) => Boolean(field.id) && Boolean(field.type))).toBe(true);
  });

  it("marks required parameters as required", () => {
    const fields = getRunnableTool("web_search")?.formSchema.steps[0]?.fields ?? [];

    expect(fields.some((field) => field.required)).toBe(true);
  });

  it("returns null for an unknown tool", () => {
    expect(getRunnableTool("not_a_tool")).toBeNull();
  });
});
