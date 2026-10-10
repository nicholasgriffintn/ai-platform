import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireHostedHermesAccess } from "~/infrastructure/providers/capabilities/agent-host/hostedHermesAccess";
import { prepareHostedHermes } from "~/infrastructure/providers/capabilities/agent-host/hostedHermesTurn";

export async function wakeHostedHermes(context: ServiceContext): Promise<{ ready: true }> {
  const { user, client } = requireHostedHermesAccess(context);

  await prepareHostedHermes(context, client, user.id);

  return { ready: true };
}
