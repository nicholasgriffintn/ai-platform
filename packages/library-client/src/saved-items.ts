import type { ListSavedItemsQuery, SaveItemInput, SavedItem } from "@ngriffin_uk/polychat-schemas";

import { resource } from "./resource.js";

export const savedItems = resource<SavedItem, SaveItemInput>("/conversations/saved_items");

export function listSavedItems(query: ListSavedItemsQuery = {}): Promise<SavedItem[]> {
  return savedItems.listAll(query);
}
