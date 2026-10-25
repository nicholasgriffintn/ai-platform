import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { analyseArticleFraming } from "./framing";

const generateTierObject = vi.hoisted(() => vi.fn());

vi.mock("~/modules/models/application/tier-object", () => ({ generateTierObject }));
vi.mock("~/modules/documents/application/editorial-quality", () => ({
  gradeEditorialQuality: vi.fn(async () => null),
}));

const ARTICLE = "Ministers unveiled a reckless plan to scrap the tax on Tuesday, critics said.";

describe("analyseArticleFraming", () => {
  it("keeps only loaded wording that appears in the article and reports the rest", async () => {
    generateTierObject.mockResolvedValue({
      overview: "Frames the plan through its critics.",
      slant: "leans",
      tone: "disapproving",
      sourcing: "Quotes unnamed critics only.",
      loadedLanguage: [
        { quote: "a reckless plan", note: "Judges the plan before describing it." },
        { quote: "a disastrous gamble", note: "Invented by the model." },
      ],
      missingPerspectives: ["Why ministers want to scrap the tax."],
    });
    const context = { env: {}, requireUser: () => ({ id: 7 }) } as unknown as ServiceContext;

    const result = await analyseArticleFraming(context, ARTICLE);

    expect(result.framing.loadedLanguage.map((item) => item.quote)).toEqual(["a reckless plan"]);
    expect(result.missingQuotes).toEqual(["a disastrous gamble"]);
  });
});
