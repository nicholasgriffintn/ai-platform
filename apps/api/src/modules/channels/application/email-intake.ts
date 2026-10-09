import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { resolveTxtOverHttps } from "@ngriffin_uk/polychat-utility-server/dns";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { parseInboundEmail } from "~/modules/channels/infrastructure/adapters/email-payload";
import type { IEnv } from "~/types";

import { admitChannelMessage } from "./admission";

const logger = getLogger({ prefix: "services/channels/email" });

const MAX_EMAIL_BYTES = 5 * 1024 * 1024;

export interface InboundEmail {
  readonly to: string;
  readonly raw: ReadableStream<Uint8Array>;
  readonly rawSize: number;
  setReject(reason: string): void;
}

export async function receiveChannelEmail(env: IEnv, message: InboundEmail): Promise<void> {
  const inbox = env.EMAIL_INBOUND_ADDRESS?.toLowerCase();

  if (!inbox || message.to.toLowerCase() !== inbox) {
    message.setReject("Polychat does not receive mail at this address");

    return;
  }

  if (message.rawSize > MAX_EMAIL_BYTES) {
    message.setReject("The message is too large for Polychat");

    return;
  }

  const raw = new Uint8Array(await new Response(message.raw).arrayBuffer());
  const intake = await parseInboundEmail(raw, {
    recipient: inbox,
    resolveTxt: resolveTxtOverHttps,
  });

  if (intake.status === "refused") {
    logger.warn("Refused an inbound email", { reason: intake.reason });
    message.setReject(intake.reason);

    return;
  }

  if (intake.status === "ignored") {
    logger.info("Ignored an inbound email", { reason: intake.reason });

    return;
  }

  const admission = await admitChannelMessage({
    env,
    context: createServiceContext({ env }),
    channel: "email",
    incoming: intake.incoming,
    source: "channel_email",
  });

  if (admission.status === "ignored") {
    message.setReject("This address is not linked to Polychat");
  }
}
