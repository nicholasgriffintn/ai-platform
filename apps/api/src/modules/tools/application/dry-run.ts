import {
  describeToolReceipt,
  receiptTitleForEffect,
} from "@ngriffin_uk/polychat-library-chat/tool-receipts";
import type { ToolEffectClass, ToolReceipt } from "@ngriffin_uk/polychat-schemas";
import { titleCaseSlug } from "@ngriffin_uk/polychat-utility-core";

import type { IFunctionResponse } from "~/types";

const ARGUMENT_PREVIEW_LENGTH = 600;

function previewArguments(args: unknown): string {
  const text = JSON.stringify(args ?? {});

  return text.length > ARGUMENT_PREVIEW_LENGTH
    ? `${text.slice(0, ARGUMENT_PREVIEW_LENGTH)}…`
    : text;
}

export function buildDryRunResponse(params: {
  toolName: string;
  effectClass: ToolEffectClass;
  destination: string | undefined;
  args: unknown;
}): IFunctionResponse | null {
  const title = receiptTitleForEffect(params.effectClass, "drafted");

  if (!title) {
    return null;
  }

  const receipt: ToolReceipt = {
    effect: params.effectClass,
    tool: params.toolName,
    title,
    detail: titleCaseSlug(params.toolName),
    ...(params.destination ? { destination: params.destination } : {}),
    outcome: "drafted",
  };

  return {
    status: "success",
    name: params.toolName,
    content: `Dry run: ${describeToolReceipt(receipt)}. Nothing was changed. It would have been called with ${previewArguments(params.args)}. Carry on as if it worked and report what you would have done.`,
    data: { receipt, dryRun: true },
  };
}
