import type { AppWorkflows } from "~/modules/queue/application/workflows";

import { InboundMessageHandler } from "./InboundMessageHandler";

export function registerChannelsQueue(workflows: AppWorkflows): void {
  workflows.register("inbound_message", new InboundMessageHandler());
}
