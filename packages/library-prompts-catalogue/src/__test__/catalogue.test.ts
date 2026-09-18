import { describe, expect, it } from "vitest";

import {
  getCataloguePromptEntriesByTask,
  getCataloguePromptEntry,
  getCataloguePromptEntryByTask,
  listCataloguePromptEntries,
  promptEntries,
  validatePromptCatalogue,
} from "../index.js";

describe("prompt catalogue", () => {
  it("is internally consistent", () => {
    expect(validatePromptCatalogue()).toEqual([]);
  });

  it("resolves every entry by id", () => {
    for (const entry of promptEntries) {
      expect(getCataloguePromptEntry(entry.id)).toBe(entry);
    }
  });

  it("resolves entries by task and variant", () => {
    const formatting = getCataloguePromptEntriesByTask("chat-section").filter((entry) =>
      entry.id.startsWith("chat/formatting/"),
    );

    expect(formatting).toHaveLength(2);
    expect(getCataloguePromptEntryByTask("chat-section", "coding")).toBeDefined();
    expect(listCataloguePromptEntries({ variant: "coding" }).length).toBeGreaterThan(0);
  });

  it("returns no entries for unknown ids", () => {
    expect(getCataloguePromptEntry("not/a-prompt")).toBeUndefined();
  });
});
