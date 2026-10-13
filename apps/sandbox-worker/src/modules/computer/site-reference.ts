import {
  siteReferenceCaptureRequestSchema,
  siteReferenceCaptureResultSchema,
} from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";

import type { Env } from "../../types";
import { startComputer } from "./browser";

export async function handleSiteReference(request: Request, env: Env): Promise<Response> {
  const parsed = siteReferenceCaptureRequestSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return Response.json({ error: "Invalid site reference request" }, { status: 400 });
  }

  const sandbox = env.COMPUTER.get(env.COMPUTER.idFromName(parsed.data.resourceId));

  try {
    await startComputer(sandbox);
    await sandbox.writeFile("/workspace/site-reference.json", JSON.stringify(parsed.data));
    const result = await sandbox.exec(
      "python3 /usr/local/bin/read-site-reference < /workspace/site-reference.json",
      { timeoutMs: 45_000 },
    );
    const capture = result.success
      ? siteReferenceCaptureResultSchema.safeParse(safeParseJson<unknown>(result.stdout))
      : null;

    return Response.json(capture?.success ? capture.data : { status: "unavailable" });
  } catch {
    return Response.json({ status: "unavailable" });
  } finally {
    await sandbox.destroy().catch(() => undefined);
  }
}
