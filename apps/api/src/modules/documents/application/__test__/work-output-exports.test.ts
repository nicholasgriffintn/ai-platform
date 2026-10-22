import { describe, expect, it } from "vitest";

import { exportDeck, exportSheet } from "../work-output-exports";

describe("work output exports", () => {
  it("writes each sheet table under its name and neutralises formulas in text", () => {
    const exported = exportSheet("Q3 budget", {
      format: "tables",
      tables: [
        {
          name: "Spend",
          columns: [
            { key: "item", label: "Item", type: "text" },
            { key: "cost", label: "Cost", type: "currency", currency: "GBP" },
          ],
          rows: [
            { item: '=HYPERLINK("http://x")', cost: -120.5 },
            { item: "Desks, chairs", cost: null },
          ],
        },
        {
          name: "Notes",
          columns: [{ key: "note", label: "Note", type: "text" }],
          rows: [{ note: "ok" }],
        },
      ],
    });

    expect(exported.filename).toBe("q3-budget.csv");
    expect(exported.body).toBe(
      [
        "Spend",
        "Item,Cost",
        `"'=HYPERLINK(""http://x"")",-120.5`,
        '"Desks, chairs",',
        "",
        "Notes",
        "Note",
        "ok",
        "",
      ].join("\r\n"),
    );
  });

  it("writes a deck as Markdown slides with notes hidden in comments", () => {
    const exported = exportDeck("Launch", {
      format: "slides",
      slides: [
        { layout: "title", title: "Launch plan", subtitle: "October", bullets: [] },
        {
          layout: "content",
          title: "Three bets",
          bullets: ["Ship desktop", "Ship iOS"],
          notes: "Pause here --> then",
        },
      ],
    });

    expect(exported.filename).toBe("launch.md");
    expect(exported.body).toBe(
      "# Launch plan\n\n_October_\n\n---\n\n## Three bets\n\n- Ship desktop\n- Ship iOS\n\n<!-- Notes: Pause here --&gt; then -->\n",
    );
  });
});
