import { prepareToolFormData, runnableToolSchema } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { decide } from "~/modules/functions/application/definitions/decide";

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

  it("offers Clef models in the Decide form with readable labels", () => {
    const field = getRunnableTool("decide")?.formSchema.steps[0]?.fields.find(
      (candidate) => candidate.id === "model",
    );

    expect(field).toMatchObject({
      type: "select",
      label: "Decision model",
      required: false,
    });
    expect(field?.validation?.options).toEqual(
      expect.arrayContaining([
        { value: "auto", label: "Automatic" },
        { value: "@cf/cloudflare/clef", label: "Clef" },
        { value: "@cf/cloudflare/clef-flash", label: "Clef Flash" },
        { value: "typesafe/jev-latest", label: "Jev" },
      ]),
    );
  });

  it("converts the Decide form's JSON text into valid execution arguments", () => {
    const tool = runnableToolSchema.parse(getRunnableTool("decide"));
    const state = ["Checkout has failed for every customer. There is no workaround."];
    const questions = {
      urgent: { type: "noul", instructions: "Does this incident need urgent attention?" },
      team: {
        type: "choice",
        instructions: "Which team should handle this incident?",
        criteria: { billing: "Invoice disputes and refunds", technical: "Outages and errors" },
      },
      severity: {
        type: "score",
        instructions: "How severe is the customer impact?",
        criteria: ["No impact", "Minor", "Major", "Critical"],
      },
    };
    const data = prepareToolFormData(tool.formSchema, {
      model: "@cf/cloudflare/clef",
      state: JSON.stringify(state),
      questions: JSON.stringify(questions),
    });

    expect(decide.inputSchema.parse(data)).toEqual({
      model: "@cf/cloudflare/clef",
      state,
      questions,
    });
  });
});
