import { fetchApiOrThrow } from "./fetch-wrapper.js";

export async function wakeHostedHermes(): Promise<void> {
  await fetchApiOrThrow("/models/agents/hermes/wake", { method: "POST" });
}
