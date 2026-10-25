import { hasProEntitlement } from "@ngriffin_uk/polychat-library-policy";
import {
  readSiteReferenceFontFamily,
  resolveSiteReferencePalette,
  siteGoogleFontFamily,
} from "@ngriffin_uk/polychat-library-sites";
import {
  siteReferenceCaptureResultSchema,
  type SiteCustomFonts,
  type SiteTheme,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

const FONT_CHECK_TIMEOUT_MS = 5_000;

async function isGoogleFont(name: string, signal?: AbortSignal): Promise<boolean> {
  const timeout = AbortSignal.timeout(FONT_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://fonts.googleapis.com/css2?family=${siteGoogleFontFamily(name)}&display=swap`,
      { signal: signal ? AbortSignal.any([signal, timeout]) : timeout },
    );

    return response.ok;
  } catch {
    signal?.throwIfAborted();

    return false;
  }
}

async function resolveReferenceFonts(
  headingFamily: string | null,
  bodyFamily: string | null,
  signal?: AbortSignal,
): Promise<SiteCustomFonts | undefined> {
  const heading = readSiteReferenceFontFamily(headingFamily);
  const body = readSiteReferenceFontFamily(bodyFamily);
  const names = [...new Set([heading, body].filter((name) => name !== null))];
  const available = new Set(
    (
      await Promise.all(
        names.map(async (name) => ((await isGoogleFont(name, signal)) ? name : null)),
      )
    ).filter((name) => name !== null),
  );
  const fonts: SiteCustomFonts = {
    ...(heading && available.has(heading) ? { heading } : {}),
    ...(body && available.has(body) ? { body } : {}),
  };

  return fonts.heading || fonts.body ? fonts : undefined;
}

export async function readSiteReferenceTheme(
  context: ServiceContext,
  url: string,
  signal?: AbortSignal,
): Promise<Partial<SiteTheme>> {
  if (!hasProEntitlement(context.requireUser())) {
    throw new AssistantError("Reference sites need a Pro account", ErrorType.FORBIDDEN, 403);
  }

  if (!context.env.SANDBOX_WORKER) {
    throw new AssistantError(
      "Reference sites are not available on this deployment",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  const response = await context.env.SANDBOX_WORKER.fetch(
    "https://computer.internal/computer/site-reference",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceId: `site-reference-${generateId()}`, url }),
      signal,
    },
  );
  const capture = response.ok
    ? siteReferenceCaptureResultSchema.safeParse(await response.json())
    : null;

  if (!capture?.success || capture.data.status !== "captured") {
    throw new AssistantError(
      "Could not read colours and fonts from the reference site",
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  const customFonts = await resolveReferenceFonts(
    capture.data.headingFamily,
    capture.data.bodyFamily,
    signal,
  );

  return {
    ...resolveSiteReferencePalette(capture.data),
    ...(customFonts ? { customFonts } : {}),
  };
}
