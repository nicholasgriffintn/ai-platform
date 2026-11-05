import type {
  ChatRun,
  CouncilReviewVerdict,
  GoalEvidenceEntry,
  RunVerification,
  RunVerificationFinding,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { MessageRepository } from "~/modules/conversations/infrastructure/MessageRepository";
import { formatOutput } from "~/modules/outputs/application";
import { assessRunVerification } from "~/modules/outputs/domain/run-verification";
import type { OutputRecord } from "~/modules/outputs/infrastructure/OutputRepository";

import {
  checkOfficePackage,
  checkWorkOutputRoundTrip,
  MAX_OFFICE_PACKAGE_BYTES,
  officeFileTooLarge,
  officeFormatFor,
  type RoundTripResult,
} from "./office-round-trip";
import { parseWorkOutput } from "./work-outputs";

async function checkStoredOffice(
  context: ServiceContext,
  record: OutputRecord,
  format: string,
): Promise<RoundTripResult> {
  try {
    const object = await StorageService.forPrivateAssets(context).getObjectBody(
      record.storage_key ?? "",
    );

    if (!object) {
      return { status: "failed", detail: "This file is missing from storage." };
    }

    return object.size > MAX_OFFICE_PACKAGE_BYTES
      ? officeFileTooLarge()
      : checkOfficePackage(new Uint8Array(await object.arrayBuffer()), format);
  } catch (error) {
    return {
      status: "unverified",
      detail: `This file could not be read to check it: ${getErrorMessage(error, "storage error")}`,
    };
  }
}

async function checkOutputFile(
  context: ServiceContext,
  record: OutputRecord,
): Promise<RunVerificationFinding | null> {
  const format = record.storage_key
    ? officeFormatFor({ mimeType: record.mime_type, filename: record.filename })
    : null;
  const file = record.storage_key ? null : parseWorkOutput(formatOutput(record));
  const result = format
    ? await checkStoredOffice(context, record, format)
    : file
      ? checkWorkOutputRoundTrip(file)
      : null;

  return result ? { check: "file", outputId: record.id, ...result } : null;
}

export async function verifyRun(
  context: ServiceContext,
  params: {
    run: Pick<ChatRun, "id" | "conversationId"> | null;
    outputs: readonly OutputRecord[];
    ledger?: readonly GoalEvidenceEntry[];
    councilVerdicts?: readonly CouncilReviewVerdict[];
  },
): Promise<RunVerification> {
  const messages = params.run
    ? await context.repositories
        .get(MessageRepository)
        .getRunMessages(params.run.conversationId, params.run.id)
    : [];
  const outputs = params.outputs.filter((output) => output.status === "ready");
  const fileFindings: RunVerificationFinding[] = [];

  for (const output of outputs) {
    const finding = await checkOutputFile(context, output);

    if (finding) {
      fileFindings.push(finding);
    }
  }

  return assessRunVerification({
    ledger: params.ledger,
    toolResults: messages.flatMap((message) =>
      message.role === "tool"
        ? [{ name: String(message.name ?? ""), status: String(message.status ?? "") }]
        : [],
    ),
    outputCount: outputs.length,
    fileFindings,
    councilVerdicts: params.councilVerdicts,
    checkedAt: new Date().toISOString(),
  });
}
