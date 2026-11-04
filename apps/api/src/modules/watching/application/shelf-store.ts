import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  emptyShelf,
  shelfContentSchema,
  WATCHING_SHELF_GROUP,
  WATCHING_SHELF_KIND,
  type ShelfContent,
} from "~/modules/watching/domain/shelf";

import {
  readWatchingDocument,
  updateWatchingDocument,
  type WatchingDocument,
} from "./document-store";

const SHELF_DOCUMENT: WatchingDocument<ShelfContent> = {
  kind: WATCHING_SHELF_KIND,
  group: WATCHING_SHELF_GROUP,
  title: "Film and TV shelf",
  idPrefix: "watching_shelf",
  schema: shelfContentSchema,
  empty: emptyShelf,
};

export function readShelfContent(context: ServiceContext): Promise<ShelfContent> {
  return readWatchingDocument(context, SHELF_DOCUMENT);
}

export function updateShelfContent(
  context: ServiceContext,
  change: (content: ShelfContent) => ShelfContent,
): Promise<ShelfContent> {
  return updateWatchingDocument(context, SHELF_DOCUMENT, change);
}
