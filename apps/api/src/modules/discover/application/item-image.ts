import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";
import {
  fetchFollowingSafeRedirects,
  readResponseBytesWithinLimit,
} from "@ngriffin_uk/polychat-utility-server/http";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { isDiscoverImageType } from "~/modules/discover/domain/live";

import { readDiscoverLive } from "./live-store";

const logger = getLogger({ prefix: "discover/item-image" });
const DISCOVER_IMAGE_BYTES = 5_000_000;
const DISCOVER_IMAGE_CACHE_CONTROL = "private, max-age=86400";

function imageNotFound(): AssistantError {
  return new AssistantError("Discover image not found", ErrorType.NOT_FOUND, 404);
}

export async function readDiscoverItemImage(
  context: ServiceContext,
  itemId: string,
): Promise<Response> {
  const content = await readDiscoverLive(context);
  const card = content.items.find((item) => item.id === itemId)?.card;
  const url = card && "imageUrl" in card ? card.imageUrl : undefined;

  if (!url) {
    throw imageNotFound();
  }

  try {
    const response = await fetchFollowingSafeRedirects(url, { headers: { accept: "image/*" } });
    const contentType = response.headers.get("content-type") ?? "";

    if (!response.ok || !isDiscoverImageType(contentType)) {
      await response.body?.cancel();
      throw imageNotFound();
    }

    const bytes = await readResponseBytesWithinLimit(response, DISCOVER_IMAGE_BYTES);

    return new Response(new Uint8Array(bytes), {
      headers: {
        "cache-control": DISCOVER_IMAGE_CACHE_CONTROL,
        "content-type": contentType,
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    logger.warn("A Discover story image could not be read", {
      error_message: getErrorMessage(error),
    });

    throw imageNotFound();
  }
}
