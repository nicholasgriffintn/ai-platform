import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { DiscoverWindDownBed } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { fetchFollowingSafeRedirects } from "@ngriffin_uk/polychat-utility-server/http";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { getPrivateObjectResponse } from "~/infrastructure/storage/read-resource";
import { WIND_DOWN_BED_PROMPTS, WIND_DOWN_BED_SECONDS } from "~/modules/discover/domain/wind-down";
import { generateMusic } from "~/modules/generate/application/music";

const logger = getLogger({ prefix: "discover/wind-down-beds" });

function bedKey(bed: DiscoverWindDownBed): string {
  return `discover/wind-down/beds/${bed}`;
}

export async function hasWindDownBed(
  context: ServiceContext,
  bed: DiscoverWindDownBed,
): Promise<boolean> {
  return Boolean(await StorageService.forPrivateAssets(context).headObject(bedKey(bed)));
}

export async function ensureWindDownBed(
  context: ServiceContext,
  bed: DiscoverWindDownBed,
): Promise<boolean> {
  if (await hasWindDownBed(context, bed)) {
    return true;
  }

  const result = await generateMusic({
    completion_id: `wind_down_bed_${bed}`,
    app_url: context.env.APP_BASE_URL,
    context,
    user: context.requireUser(),
    args: { prompt: WIND_DOWN_BED_PROMPTS[bed], duration: WIND_DOWN_BED_SECONDS },
  });
  const url = isRecord(result.data) && typeof result.data.url === "string" ? result.data.url : null;

  if (result.status !== "success" || !url) {
    logger.warn("Wind down sound could not be made", { bed, reason: result.content });

    return false;
  }

  const response = await fetchFollowingSafeRedirects(url);

  if (!response.ok) {
    return false;
  }

  await StorageService.forPrivateAssets(context).uploadObject(
    bedKey(bed),
    new Uint8Array(await response.arrayBuffer()),
    { httpMetadata: { contentType: response.headers.get("content-type") ?? "audio/mpeg" } },
  );

  return true;
}

export function readWindDownBed(
  context: ServiceContext,
  bed: DiscoverWindDownBed,
  rangeHeader?: string | null,
): Promise<Response> {
  return getPrivateObjectResponse(
    context,
    bedKey(bed),
    { filename: bed, mimeType: "audio/mpeg" },
    rangeHeader,
  );
}
