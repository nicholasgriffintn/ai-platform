import {
  DECK_WRITE_TOOL_NAME,
  SHEET_WRITE_TOOL_NAME,
  writeDeckInputSchema,
  writeSheetInputSchema,
} from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "~/types/functions";

function intentEvidence(input: { outputId?: string; projectId?: string }, kind: string) {
  return {
    operation: input.outputId ? `revise_${kind}` : `create_${kind}`,
    scope: input.projectId ? "project" : "personal",
  };
}

export const write_deck: FunctionToolDescriptor = {
  name: DECK_WRITE_TOOL_NAME,
  description:
    "Write a slide deck in Files: a pitch, a review, a briefing. Open with a title slide, give each slide one headline that states its point, and keep bullets short. When revising, read it with get_document first, then pass its outputId and expectedRevision.",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "draft" },
  inputSchema: writeDeckInputSchema,
  intentEvidence: (input) => ({
    ...intentEvidence(input, "deck"),
    slides: input.slides.length,
  }),
};

export const write_sheet: FunctionToolDescriptor = {
  name: SHEET_WRITE_TOOL_NAME,
  description:
    "Write a spreadsheet in Files: one or more named tables with typed columns, such as a budget, a comparison or a tracker. Put raw numbers in number, currency and percent columns (0.25 for 25%), dates as YYYY-MM-DD. When revising, read it with get_document first, then pass its outputId and expectedRevision.",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "draft" },
  inputSchema: writeSheetInputSchema,
  intentEvidence: (input) => ({
    ...intentEvidence(input, "sheet"),
    tables: input.tables.length,
    rows: input.tables.reduce((total, table) => total + table.rows.length, 0),
  }),
};
