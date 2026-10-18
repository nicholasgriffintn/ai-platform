import {
  readToolReceiptOverride,
  receiptTitleForEffect,
} from "@ngriffin_uk/polychat-library-chat/tool-receipts";
import {
  ToolResponseType,
  type ToolEffectClass,
  type ToolReceipt,
  type ToolReceiptOutcome,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord, titleCaseSlug } from "@ngriffin_uk/polychat-utility-core";

import type { IFunctionResponse } from "~/types";

export function buildToolReceipt(params: {
  toolName: string;
  effectClass: ToolEffectClass;
  destination: string | undefined;
  response: IFunctionResponse;
  outcome: ToolReceiptOutcome;
}): ToolReceipt | undefined {
  const { response } = params;
  const data = isRecord(response.data) ? response.data : undefined;

  if (response.status === "error" || data?.responseType === ToolResponseType.HIDDEN) {
    return undefined;
  }

  const title = receiptTitleForEffect(params.effectClass, params.outcome);

  if (!title) {
    return undefined;
  }

  const override = readToolReceiptOverride(data);

  return {
    effect: params.effectClass,
    tool: params.toolName,
    title: override?.title ?? title,
    detail:
      override?.detail ??
      (typeof data?.formattedName === "string"
        ? data.formattedName
        : titleCaseSlug(params.toolName)),
    ...(params.destination ? { destination: params.destination } : {}),
    outcome: params.outcome,
  };
}
