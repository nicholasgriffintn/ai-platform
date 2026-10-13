import {
  LISTED_CONVERSATION_TYPES,
  SEARCHABLE_CONVERSATION_TYPES,
} from "@ngriffin_uk/polychat-schemas";

export const listedConversationTypesSql = LISTED_CONVERSATION_TYPES.map((type) => `'${type}'`).join(
  ", ",
);

export const searchableConversationTypesSql = SEARCHABLE_CONVERSATION_TYPES.map(
  (type) => `'${type}'`,
).join(", ");
