import {
  toolReceiptOverrideSchema,
  toolReceiptSchema,
  type ToolEffectClass,
  type ToolReceipt,
  type ToolReceiptOutcome,
  type ToolReceiptOverride,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

const RECEIPT_TITLES: Record<ToolEffectClass, string | null> = {
  read: null,
  draft: null,
  write: "Updated",
  external_send: "Sent",
  spend: "Paid",
  destructive: "Deleted",
  credential: "Used a sign-in",
  data_export: "Exported",
};

export function receiptTitleForEffect(
  effect: ToolEffectClass,
  outcome: ToolReceiptOutcome,
): string | null {
  const title = RECEIPT_TITLES[effect];

  if (!title) {
    return null;
  }

  return outcome === "drafted" ? `Drafted instead of ${title.toLowerCase()}` : title;
}

export function isReceiptEffect(effect: ToolEffectClass): boolean {
  return RECEIPT_TITLES[effect] !== null;
}

export function readToolReceipt(data: unknown): ToolReceipt | undefined {
  if (!isRecord(data)) {
    return undefined;
  }

  const parsed = toolReceiptSchema.safeParse(data.receipt);

  return parsed.success ? parsed.data : undefined;
}

export function readToolReceiptOverride(data: unknown): ToolReceiptOverride | undefined {
  if (!isRecord(data)) {
    return undefined;
  }

  const parsed = toolReceiptOverrideSchema.safeParse(data.receipt);

  return parsed.success ? parsed.data : undefined;
}

export function describeToolReceipt(receipt: ToolReceipt): string {
  return [receipt.title, receipt.detail, receipt.destination].filter(Boolean).join(" · ");
}
