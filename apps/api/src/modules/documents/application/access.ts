import { DOCUMENT_OUTPUT_KIND, readDocumentBody } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { formatOutput, getOutput } from "~/modules/outputs/application";
import { requireOutputAccess } from "~/modules/outputs/application/access";

export async function requireDocument(
  context: ServiceContext,
  userId: number,
  outputId: string,
  mutate = false,
) {
  const output = mutate
    ? formatOutput(await requireOutputAccess(context, userId, outputId, true))
    : await getOutput(context, userId, outputId);
  const body = readDocumentBody(output.content);

  if (output.kind !== DOCUMENT_OUTPUT_KIND || body === null) {
    throw new AssistantError("That result is not a document", ErrorType.PARAMS_ERROR, 400);
  }

  return { output, body };
}
