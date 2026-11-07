import { fetchTmdbTitle, searchTmdbPerson } from "@ngriffin_uk/polychat-ai-integrations";
import { hasProEntitlement } from "@ngriffin_uk/polychat-library-policy";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  findShelfEntry,
  listRecentEntries,
  saveShelfEntry,
  setShelfFollow,
  type ShelfEntry,
} from "~/modules/watching/domain/shelf";
import type { ViewingStatus } from "~/modules/watching/domain/titles";

import { requireTitleRef, requireTmdbToken } from "./catalogue";
import { readShelfContent, updateShelfContent } from "./shelf-store";
import { indexTitleIfMissing } from "./title-index";
import { syncShelfChangeToTrakt } from "./trakt";

export async function readShelf(context: ServiceContext, status?: ViewingStatus) {
  const shelf = await readShelfContent(context);

  return {
    entries: listRecentEntries(shelf, status ? [status] : undefined).map((entry) => ({
      id: entry.titleId,
      imdbId: entry.imdbId,
      title: entry.title,
      year: entry.year,
      status: entry.status,
      rating: entry.rating,
      thoughts: entry.thoughts,
    })),
    following: shelf.following.map((person) => person.name),
  };
}

export async function saveToShelf(
  context: ServiceContext,
  input: { titleId: string; status: ViewingStatus; rating?: number; thoughts?: string },
) {
  const details = await fetchTmdbTitle(requireTmdbToken(context), requireTitleRef(input.titleId));

  let previous: ShelfEntry | undefined;
  const shelf = await updateShelfContent(context, (content) => {
    previous = findShelfEntry(content, details.id);

    return saveShelfEntry(content, {
      titleId: details.id,
      mediaType: details.mediaType,
      title: details.title,
      year: details.year,
      status: input.status,
      rating: input.rating,
      thoughts: input.thoughts,
    });
  });
  const saved = findShelfEntry(shelf, details.id);

  if (hasProEntitlement(context.user)) {
    await indexTitleIfMissing(context.env, details.id);
  }

  return {
    id: details.id,
    title: details.title,
    status: input.status,
    trakt: saved ? await syncShelfChangeToTrakt(context, previous, saved) : "failed",
  };
}

export async function setPersonFollowed(
  context: ServiceContext,
  input: { name: string; follow: boolean },
) {
  const person = await searchTmdbPerson(requireTmdbToken(context), input.name);

  if (!person) {
    throw new AssistantError(`No one called ${input.name} was found`, ErrorType.NOT_FOUND, 404);
  }

  await updateShelfContent(context, (shelf) => setShelfFollow(shelf, person, input.follow));

  return person;
}
