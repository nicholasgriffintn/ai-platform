import { getSandbox } from "@cloudflare/sandbox";
import {
  siteBrowserCaptureRequestSchema,
  siteBrowserCaptureResultSchema,
} from "@ngriffin_uk/polychat-schemas";
import { isPrivateHostname, safeParseJson } from "@ngriffin_uk/polychat-utility-core";

import { startComputer } from "./browser";
import type { Env } from "./types";

export async function handleSiteVerification(request: Request, env: Env): Promise<Response> {
  const parsed = siteBrowserCaptureRequestSchema.safeParse(await request.json().catch(() => null));

  if (
    !parsed.success ||
    parsed.data.allowedOrigins.some((value) => {
      const url = new URL(value);

      return url.protocol !== "https:" || isPrivateHostname(url.hostname) || url.origin !== value;
    })
  ) {
    return Response.json({ error: "Invalid site verification request" }, { status: 400 });
  }

  const sandbox = getSandbox(env.Computer, parsed.data.resourceId, { normalizeId: true });

  try {
    await startComputer(sandbox);
    const result = await sandbox.exec("python3 /usr/local/bin/verify-site", {
      env: { SITE_CAPTURE: JSON.stringify(parsed.data) },
      timeout: 60_000,
    });
    const capture = result.success
      ? siteBrowserCaptureResultSchema.safeParse(safeParseJson<unknown>(result.stdout))
      : null;

    return Response.json(
      capture?.success ? capture.data : { status: "unavailable", diagnostics: [] },
    );
  } catch {
    return Response.json({ status: "unavailable", diagnostics: [] });
  } finally {
    await sandbox.destroy().catch(() => undefined);
  }
}
