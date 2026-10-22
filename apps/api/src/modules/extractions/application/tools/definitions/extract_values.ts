import { getModelsByOutputModality } from "@ngriffin_uk/polychat-ai-models";
import { extractionFieldsSchema } from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { FunctionToolDescriptor } from "~/types/functions";

function buildInputSchema() {
  const extractionModels = Object.entries(getModelsByOutputModality("extraction"));

  return z.object({
    model: z
      .enum(["auto", ...extractionModels.map(([id]) => id)])
      .optional()
      .describe("Choose an extraction model, or use Automatic to let the account select one.")
      .meta({
        title: "Extraction model",
        enumNames: ["Automatic", ...extractionModels.map(([id, model]) => model.name || id)],
      }),
    state: z
      .string()
      .min(1)
      .max(200_000)
      .describe("Enter the text to read: an email, invoice, transcript, table or series."),
    fields: extractionFieldsSchema.describe(
      'Enter a JSON object mapping field names to typed fields, such as {"total":{"type":"number","decimals":2,"unit":"GBP"}}. Types: text (a span of the input), number (decimals, integer, unit), date, time, datetime, duration (unit: seconds to years), list (items: text, number or date), estimate (min, max, optional step and scale linear or log), forecast (min, max, horizon, interval). Add instructions in plain language to say exactly what each field means.',
    ),
    reference_date: z.iso
      .date()
      .optional()
      .describe("Today's date or the date the text was written, so relative dates resolve."),
  });
}

let cachedInputSchema: ReturnType<typeof buildInputSchema> | undefined;

export const extract_values = {
  name: "extract_values",
  description:
    "Pull typed values out of text with a fast extraction model (Clairic) in one call: order numbers, totals, dates, durations, lists of items, plus estimates and forecasts with an 80% interval. It never writes prose, so answers are always the requested type, or null with a best guess when the input does not say. It can add or subtract a couple of values and work out date differences, but do longer arithmetic in code. Put every field you need in one call; fields are answered in parallel. Use decide afterwards when the values feed a choice.",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  get inputSchema() {
    cachedInputSchema ??= buildInputSchema();

    return cachedInputSchema;
  },
} satisfies FunctionToolDescriptor;
