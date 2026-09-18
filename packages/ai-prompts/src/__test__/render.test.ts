import { describe, expect, it } from "vitest";

import {
  PromptRenderError,
  PromptTemplateError,
  parsePromptTemplate,
  renderPromptText,
} from "../index.js";

describe("renderPromptText", () => {
  it("interpolates variables and applies defaults", () => {
    expect(renderPromptText("Hello {{name}}", { name: "Ada" })).toBe("Hello Ada");
    expect(renderPromptText("Hello {{name}}", {}, { name: "fallback" })).toBe("Hello fallback");
    expect(renderPromptText("Hello {{name}}", { name: "" }, { name: "fallback" })).toBe("Hello ");
  });

  it("renders conditional blocks only when the value is set", () => {
    const template = "a{{#flag}} yes{{/flag}} b{{^flag}} no{{/flag}}";

    expect(renderPromptText(template, { flag: "1" })).toBe("a yes b");
    expect(renderPromptText(template, {})).toBe("a b no");
    expect(renderPromptText(template, { flag: "" })).toBe("a b no");
  });

  it("supports nested blocks", () => {
    const template = "{{#a}}A{{#b}}B{{/b}}{{^b}}b{{/b}}{{/a}}";

    expect(renderPromptText(template, { a: "1", b: "1" })).toBe("AB");
    expect(renderPromptText(template, { a: "1" })).toBe("Ab");
    expect(renderPromptText(template, {})).toBe("");
  });

  it("throws for missing values and malformed templates", () => {
    expect(() => renderPromptText("Hello {{name}}", {})).toThrow(PromptRenderError);
    expect(() => renderPromptText("{{#a}}unclosed", {})).toThrow(PromptTemplateError);
    expect(() => renderPromptText("{{/a}}", {})).toThrow(PromptTemplateError);
  });

  it("parses no nodes for plain text", () => {
    expect(parsePromptTemplate("plain")).toEqual([{ type: "text", value: "plain" }]);
  });
});
