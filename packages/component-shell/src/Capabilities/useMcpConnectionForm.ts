import type { useMcpConnections } from "@ngriffin_uk/polychat-library-react";
import {
  mcpConnectionInputSchema,
  mcpOAuthStartInputSchema,
  type McpCredentialRecipient,
} from "@ngriffin_uk/polychat-schemas";
import { splitNonEmptyLines } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

export type McpConnectionAuthChoice = "sign_in" | "token";

export function useMcpConnectionForm(connections: ReturnType<typeof useMcpConnections>) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [tools, setTools] = useState("");
  const [recipient, setRecipient] = useState<McpCredentialRecipient>("polychat");
  const [authChoice, setAuthChoice] = useState<McpConnectionAuthChoice>("sign_in");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const usesSignIn = recipient === "polychat" && authChoice === "sign_in";

  const reset = () => {
    setLabel("");
    setUrl("");
    setTools("");
    setConsent(false);
  };

  const startSignIn = async () => {
    const input = mcpOAuthStartInputSchema.safeParse({
      label,
      url,
      allowedTools: splitNonEmptyLines(tools),
    });

    if (!consent || !input.success) {
      setError("Enter a label, reachable HTTPS URL and tool names, then approve the connection.");

      return;
    }

    setError(null);
    try {
      const { authorizationUrl } = await connections.startSignIn.mutateAsync(input.data);

      window.location.assign(authorizationUrl);
    } catch (startError) {
      setError(
        startError instanceof Error && startError.message
          ? startError.message
          : "Signing in could not start. Check the endpoint and try again.",
      );
    }
  };

  const saveToken = async () => {
    const input = mcpConnectionInputSchema.safeParse({
      label,
      url,
      token,
      allowedTools: splitNonEmptyLines(tools),
      credentialRecipient: recipient,
    });

    if (!consent || !input.success) {
      setError(
        "Enter a label, reachable HTTPS URL, bearer token and tool names, then approve the connection.",
      );

      return;
    }

    setError(null);
    try {
      await connections.create.mutateAsync(input.data);
      reset();
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
    recipient,
    setRecipient,
    authChoice,
    setAuthChoice,
    usesSignIn,
    consent,
    setConsent,
    error,
    submit: usesSignIn ? startSignIn : saveToken,
  };
}
