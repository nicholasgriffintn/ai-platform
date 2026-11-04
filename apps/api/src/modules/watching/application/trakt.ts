import {
  fetchTraktLibrary,
  selectUnplayedOnTrakt,
  sendTraktSync,
  type TraktSyncItem,
} from "@ngriffin_uk/polychat-ai-integrations";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  getRecipeConnectorOAuthAccess,
  startRecipeConnectorAuthorization,
} from "~/modules/connectors/application";
import type { EpisodeRef } from "~/modules/watching/domain/episodes";
import { mergeImportedLibrary, type ShelfEntry } from "~/modules/watching/domain/shelf";
import { parseTitleId } from "~/modules/watching/domain/titles";

import { updateShelfContent } from "./shelf-store";

const logger = getLogger({ prefix: "watching/trakt" });
const TRAKT_PROVIDER = "trakt";

export type TraktSyncOutcome = "synced" | "failed" | "not_connected";

interface TraktAccess {
  clientId: string;
  accessToken: string;
}

async function readAccess(context: ServiceContext) {
  return getRecipeConnectorOAuthAccess({
    context,
    userId: context.requireUser().id,
    provider: TRAKT_PROVIDER,
  });
}

function toSyncItem(entry: ShelfEntry): TraktSyncItem | null {
  const ref = parseTitleId(entry.titleId);

  return ref ? { mediaType: ref.mediaType, tmdbId: ref.tmdbId } : null;
}

export async function startTraktConnection(context: ServiceContext, requestUrl?: string) {
  const { authorizationUrl } = await startRecipeConnectorAuthorization({
    context,
    userId: context.requireUser().id,
    provider: TRAKT_PROVIDER,
    requestUrl,
  });

  return authorizationUrl;
}

async function attemptSync(
  context: ServiceContext,
  send: (access: TraktAccess) => Promise<void>,
): Promise<TraktSyncOutcome> {
  try {
    const access = await readAccess(context);

    if (!access) {
      return "not_connected";
    }

    await send(access);

    return "synced";
  } catch (error) {
    logger.warn("Could not sync to Trakt", { error_message: getErrorMessage(error) });

    return "failed";
  }
}

async function sendUnplayed(access: TraktAccess, item: TraktSyncItem) {
  const { clientId, accessToken } = access;
  const unplayed = await selectUnplayedOnTrakt(clientId, accessToken, item);

  if (unplayed) {
    await sendTraktSync(clientId, accessToken, "/sync/history", [unplayed]);
  }
}

export function syncShelfChangeToTrakt(
  context: ServiceContext,
  previous: ShelfEntry | undefined,
  entry: ShelfEntry,
): Promise<TraktSyncOutcome> {
  return attemptSync(context, async (access) => {
    const { clientId, accessToken } = access;
    const item = toSyncItem(entry);

    if (!item) {
      return;
    }

    if (entry.status === "watched" && previous?.status !== "watched") {
      await sendUnplayed(access, item);
      await sendTraktSync(clientId, accessToken, "/sync/watchlist/remove", [item]);
    }

    if (entry.status === "watchlist" && previous?.status !== "watchlist") {
      await sendTraktSync(clientId, accessToken, "/sync/watchlist", [item]);
    }

    if (entry.rating && entry.rating !== previous?.rating) {
      await sendTraktSync(clientId, accessToken, "/sync/ratings", [
        { ...item, rating: entry.rating * 2 },
      ]);
    }
  });
}

export function syncEpisodesToTrakt(
  context: ServiceContext,
  entry: ShelfEntry,
  episodes: readonly EpisodeRef[],
  watched: boolean,
): Promise<TraktSyncOutcome> {
  return attemptSync(context, async (access) => {
    const item = toSyncItem(entry);

    if (!item || episodes.length === 0) {
      return;
    }

    if (watched) {
      await sendUnplayed(access, { ...item, episodes });
    } else {
      await sendTraktSync(access.clientId, access.accessToken, "/sync/history/remove", [
        { ...item, episodes },
      ]);
    }
  });
}

export async function importFromTrakt(context: ServiceContext) {
  const access = await readAccess(context);

  if (!access) {
    return null;
  }

  const library = await fetchTraktLibrary(access.clientId, access.accessToken);
  let added = 0;
  let updated = 0;

  await updateShelfContent(context, (shelf) => {
    const result = mergeImportedLibrary(shelf, library);

    added = result.added;
    updated = result.updated;

    return result.shelf;
  });

  return {
    added,
    updated,
    watched: library.watched.length,
    watchlist: library.watchlist.length,
    rated: library.ratings.length,
  };
}
