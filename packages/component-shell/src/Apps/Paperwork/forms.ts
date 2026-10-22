import type { ExtractionField } from "@ngriffin_uk/polychat-schemas";

export interface PaperworkField {
  name: string;
  label: string;
  field: ExtractionField;
  money?: boolean;
}

export interface PaperworkForm {
  id: string;
  label: string;
  hint: string;
  totalField: string;
  fields: readonly PaperworkField[];
}

const money = (name: string, label: string, instructions: string): PaperworkField => ({
  name,
  label,
  money: true,
  field: { type: "number", decimals: 2, instructions },
});

export const PAPERWORK_FORMS: readonly PaperworkForm[] = [
  {
    id: "receipt",
    label: "Receipts",
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
  {
    id: "invoice",
    label: "Invoices",
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
  {
    id: "claim",
    label: "Damage claims",
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
];
