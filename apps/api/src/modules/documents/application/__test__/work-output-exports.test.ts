import { describe, expect, it } from "vitest";

import { exportSheet } from "../work-output-exports";

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
});
