import z from "zod/v4";

import { extractionResponseSchema, type ExtractionField } from "./extractions.js";

export const SOURCE_READING_METADATA_KEY = "reading";

export const SOURCE_READ_AS_METADATA_KEY = "readAs";

export const READING_FORM_IDS = ["receipt", "invoice", "claim"] as const;

export const readingFormIdSchema = z.enum(READING_FORM_IDS);

export type ReadingFormId = z.infer<typeof readingFormIdSchema>;

export interface ReadingField {
  name: string;
  label: string;
  field: ExtractionField;
  money?: boolean;
}

export interface ReadingForm {
  id: ReadingFormId;
  label: string;
  singular: string;
  hint: string;
  totalField: string;
  fields: readonly ReadingField[];
}

const money = (name: string, label: string, instructions: string): ReadingField => ({
  name,
  label,
  money: true,
  field: { type: "number", decimals: 2, instructions },
});

export const READING_FORMS: Record<ReadingFormId, ReadingForm> = {
  receipt: {
    id: "receipt",
    label: "Receipts",
    singular: "receipt",
    hint: "Till receipts and card slips, photographed at whatever angle you managed.",
    totalField: "total",
    fields: [
      {
        name: "merchant",
        label: "Merchant",
        field: { type: "text", instructions: "Name of the shop, restaurant or business" },
      },
      {
        name: "purchased_at",
        label: "Purchased",
        field: { type: "datetime", instructions: "When the purchase was made" },
      },
      money("subtotal", "Subtotal", "Total before tax, tip and discounts"),
      money("tax", "Tax", "Sales tax or VAT charged"),
      money("tip", "Tip", "Tip or service charge"),
      money("discount", "Discount", "Discount taken off the bill"),
      money("total", "Total", "Amount actually paid including tax and tip"),
      {
        name: "items",
        label: "Items",
        field: { type: "list", items: "text", instructions: "Each item bought" },
      },
    ],
  },
  invoice: {
    id: "invoice",
    label: "Invoices",
    singular: "invoice",
    hint: "Supplier invoices and bills, as text or a scan.",
    totalField: "total",
    fields: [
      {
        name: "invoice_number",
        label: "Invoice",
        field: { type: "text", instructions: "Invoice number" },
      },
      {
        name: "supplier",
        label: "Supplier",
        field: { type: "text", instructions: "Business that issued the invoice" },
      },
      {
        name: "issued_on",
        label: "Issued",
        field: { type: "date", instructions: "Date the invoice was issued" },
      },
      {
        name: "due_on",
        label: "Due",
        field: {
          type: "date",
          instructions: "Due date, or the issue date plus the payment terms when none is printed",
        },
      },
      money("total", "Amount due", "Amount due including tax and shipping"),
      {
        name: "po_number",
        label: "PO",
        field: { type: "text", instructions: "Purchase order number" },
      },
      {
        name: "days_to_pay",
        label: "Likely paid after",
        field: {
          type: "estimate",
          min: 0,
          max: 120,
          step: 1,
          unit: "days",
          instructions: "Days after issue until this invoice is paid",
        },
      },
    ],
  },
  claim: {
    id: "claim",
    label: "Damage claims",
    singular: "damage claim",
    hint: "Customer emails about something that arrived broken.",
    totalField: "amount_paid",
    fields: [
      {
        name: "order_id",
        label: "Order",
        field: { type: "text", instructions: "Order number" },
      },
      {
        name: "delivered_on",
        label: "Delivered",
        field: { type: "date", instructions: "Delivery date" },
      },
      money("amount_paid", "Paid", "Total paid including tax"),
      {
        name: "days_since_delivery",
        label: "Days since delivery",
        field: {
          type: "duration",
          unit: "days",
          integer: true,
          instructions: "Days from delivery to the date the customer wrote",
        },
      },
      {
        name: "damage",
        label: "Damage",
        field: { type: "list", items: "text", instructions: "Each kind of damage described" },
      },
      {
        name: "repair_cost",
        label: "Repair estimate",
        field: {
          type: "estimate",
          min: 10,
          max: 5000,
          scale: "log",
          step: 1,
          instructions: "Cost to repair the damage described",
        },
      },
    ],
  },
};

export const sourceReadingSchema = z
  .object({
    form: readingFormIdSchema,
    answers: extractionResponseSchema.shape.answers,
    text: z.string().nullable(),
    model: z.string(),
    contentHash: z.string().min(1),
    generatedAt: z.string().min(1),
  })
  .strict();

export type SourceReading = z.infer<typeof sourceReadingSchema>;

export function readSourceReading(
  metadata: Record<string, unknown> | null | undefined,
): SourceReading | null {
  const parsed = sourceReadingSchema.safeParse(metadata?.[SOURCE_READING_METADATA_KEY]);

  return parsed.success ? parsed.data : null;
}

export function readSourceReadAs(
  metadata: Record<string, unknown> | null | undefined,
): ReadingFormId | null {
  const parsed = readingFormIdSchema.safeParse(metadata?.[SOURCE_READ_AS_METADATA_KEY]);

  return parsed.success ? parsed.data : null;
}

export const FOLDER_READ_AS_SETTING = "readAs";

export function readFolderReadAs(
  settings: Record<string, unknown> | null | undefined,
): ReadingFormId | null {
  const parsed = readingFormIdSchema.safeParse(settings?.[FOLDER_READ_AS_SETTING]);

  return parsed.success ? parsed.data : null;
}
