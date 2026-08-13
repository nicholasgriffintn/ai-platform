import { normaliseMessageParts as normaliseSchemaMessageParts } from "@ngriffin_uk/polychat-schemas/message-part-utils";
import type { Message } from "~/types";

export function normaliseMessageParts(parts: unknown): Message["parts"] | undefined {
	return normaliseSchemaMessageParts(parts);
}
