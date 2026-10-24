import { decisionStateSchema } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import "~/tools";

import { estimateToolDefinitionTokens } from "../available-functions";

describe("tool definition estimate", () => {
  it("still measures tools after a recursive input schema has been parsed", () => {
    decisionStateSchema.parse({ plan: ["first", { nested: [1, 2] }] });

    const context = Object.assign(Object.create(null), { user: { id: 1, plan_id: "pro" } });

    expect(estimateToolDefinitionTokens({ enabled_tools: ["decide"], context })).toBeGreaterThan(0);
  });
});
