import { describe, expect, it } from "vitest";

import { renderSignalDocument } from "../signal-document";

describe("renderSignalDocument", () => {
  it("explains a failed read instead of leaving the document blank", () => {
    const rendered = renderSignalDocument({
      title: "Last.fm",
      readAt: null,
      lines: [],
      error: "user is required",
      raw: null,
    });

    expect(rendered).toContain("Could not be read: user is required");
    expect(rendered).not.toContain("Nothing new");
  });

  it("lists what was read and keeps the raw result", () => {
    const rendered = renderSignalDocument({
      title: "YouTube",
      readAt: "2026-10-24T05:00:12.000Z",
      lines: ["Tom Scott", "Veritasium"],
      error: null,
      raw: '{"items":[]}',
    });

    expect(rendered).toContain("Read 2026-10-24 05:00 UTC.");
    expect(rendered).toContain("- Tom Scott\n- Veritasium");
    expect(rendered).toContain('```json\n{"items":[]}\n```');
  });
});
