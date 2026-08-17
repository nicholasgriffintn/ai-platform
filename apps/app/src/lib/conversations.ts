import { generateId } from "@ngriffin_uk/polychat-utility-core";

export function createConversationId(): string {
	return generateId();
}
