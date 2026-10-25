import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";
import type z from "zod/v4";

import type { OutputRecord } from "~/modules/outputs/infrastructure/OutputRepository";

export function readOutputContent<TContent>(
  record: OutputRecord | null,
  kind: string,
  schema: z.ZodType<TContent>,
): TContent | null {
  if (!record || record.kind !== kind) {
    return null;
  }

  const parsed = schema.safeParse(safeParseJson(record.content));

  return parsed.success ? parsed.data : null;
}
