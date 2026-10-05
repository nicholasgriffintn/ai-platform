import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { readResponseTextWithinLimit } from "@ngriffin_uk/polychat-utility-server/http";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import z from "zod/v4";

import type { IEnv } from "~/types";

const slackInstallationSchema = z.object({
  ok: z.literal(true),
  team_id: z.string().regex(/^T[A-Z0-9]+$/),
  user_id: z.string().regex(/^[UW][A-Z0-9]+$/),
});

export async function validateSlackInstallation(env: IEnv, workspaceId: string): Promise<void> {
  if (!env.SLACK_BOT_TOKEN || !env.SLACK_SIGNING_SECRET || !env.SLACK_BOT_USER_ID) {
    throw new AssistantError(
      "The Slack bot, signing secret and bot user ID must be configured before connecting a channel",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  let installation: unknown;

  try {
    const response = await fetch("https://slack.com/api/auth.test", {
      method: "POST",
      headers: { authorization: `Bearer ${env.SLACK_BOT_TOKEN}` },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error("Installation check failed");
    }

    installation = safeParseJson(await readResponseTextWithinLimit(response, 8192));
  } catch {
    throw new AssistantError(
      "The Slack installation could not be verified",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  const parsed = slackInstallationSchema.safeParse(installation);

  if (
    !parsed?.success ||
    parsed.data.team_id !== workspaceId ||
    parsed.data.user_id !== env.SLACK_BOT_USER_ID
  ) {
    throw new AssistantError(
      "The Slack workspace does not match the configured bot installation",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }
}
