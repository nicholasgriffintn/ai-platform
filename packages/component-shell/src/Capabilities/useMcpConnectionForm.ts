import type { useMcpConnections } from "@ngriffin_uk/polychat-library-react";
import { mcpConnectionInputSchema } from "@ngriffin_uk/polychat-schemas";
import { splitNonEmptyLines } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

export function useMcpConnectionForm(connections: ReturnType<typeof useMcpConnections>) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [tools, setTools] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    const input = mcpConnectionInputSchema.safeParse({
      label,
      url,
      token,
      allowedTools: splitNonEmptyLines(tools),
      credentialRecipient: "openai",
    });

    if (!consent || !input.success) {
      setError(
        "Enter a label, reachable HTTPS URL, bearer token and tool names, then approve sharing the token with OpenAI.",
      );

      return;
    }

    setError(null);
    try {
      await connections.create.mutateAsync(input.data);
      setLabel("");
      setUrl("");
      setTools("");
      setConsent(false);
    } catch {
      setError("The connection could not be saved. Check its details and try again.");
    } finally {
      setToken("");
      connections.create.reset();
    }
  };

  return {
    label,
    setLabel,
    url,
    setUrl,
    token,
    setToken,
    tools,
    setTools,
    consent,
    setConsent,
    error,
    submit,
  };
}
