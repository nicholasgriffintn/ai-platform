import type { ConnectionCheck, ProviderManifest } from "@ngriffin_uk/polychat-schemas";

import { misconfigured } from "../errors.js";
import { JsonHttpClient } from "../http.js";
import type { ConnectionChecker, ProviderAdapterContext } from "../types.js";

export const OPENAI_MANIFEST: ProviderManifest = {
  id: "openai",
  name: "OpenAI",
  vendor: "OpenAI",
  description: "Connect a workspace OpenAI account for hosted browser sessions.",
  docsUrl: "https://developers.openai.com/api/docs/guides/agents-api/overview",
  connection: { fields: [{ key: "apiKey", label: "API key", kind: "secret", required: true }] },
  source: false,
  store: null,
  trainers: [],
  hosts: [],
};

export class OpenAIConnectionChecker implements ConnectionChecker {
  constructor(private readonly context: ProviderAdapterContext) {}

  async check(): Promise<ConnectionCheck> {
    const apiKey = this.context.credentials.secrets.apiKey;

    if (!apiKey) {
      throw misconfigured("Add an OpenAI API key");
    }

    const http = new JsonHttpClient(
      "https://api.openai.com/v1",
      () => ({ Authorization: `Bearer ${apiKey}`, "OpenAI-Beta": "agents=v1" }),
      this.context.fetcher,
    );

    await http.record("/agents/sessions?limit=1", { context: "OpenAI Agents connection" });

    return {
      account: "OpenAI",
      capabilities: { read: true, store: false, train: false, host: false },
      namespaces: [],
      message: "OpenAI Agents API is reachable",
    };
  }
}
