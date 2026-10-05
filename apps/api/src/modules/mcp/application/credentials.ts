import { nativeMcpCredentialSchema, type NativeMcpCredential } from "@ngriffin_uk/polychat-schemas";
import { canonicalJson } from "@ngriffin_uk/polychat-utility-core";
import {
  decryptJsonPayload,
  encryptJsonPayload,
  isEncryptedJsonPayload,
} from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type {
  McpConnectionRecord,
  McpServerRecord,
} from "~/modules/mcp/infrastructure/McpRegistryRepository";

function credentialContext(
  server: McpServerRecord,
  connection: Pick<McpConnectionRecord, "id" | "user_id">,
) {
  return canonicalJson([
    1,
    "native-mcp",
    connection.id,
    connection.user_id,
    server.id,
    server.endpoint,
  ]);
}

function credentialKey(context: ServiceContext) {
  if (!context.env.JWT_SECRET) {
    throw new AssistantError(
      "MCP credential encryption is not configured",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  return context.env.JWT_SECRET;
}

export async function sealMcpCredential(
  context: ServiceContext,
  server: McpServerRecord,
  connection: Pick<McpConnectionRecord, "id" | "user_id">,
  credential: NativeMcpCredential,
) {
  return JSON.stringify(
    await encryptJsonPayload({
      keyMaterial: credentialKey(context),
      payload: { endpointConsent: true, credential },
      additionalData: credentialContext(server, connection),
    }),
  );
}

export async function openMcpCredential(
  context: ServiceContext,
  server: McpServerRecord,
  connection: McpConnectionRecord,
) {
  const encrypted = safeParseJson(connection.encrypted_credential);

  if (
    connection.user_id !== context.requireUser().id ||
    connection.server_id !== server.id ||
    !isEncryptedJsonPayload(encrypted)
  ) {
    throw new AssistantError("MCP connection is not available", ErrorType.AUTHORISATION_ERROR, 403);
  }

  const payload = await decryptJsonPayload({
    keyMaterial: credentialKey(context),
    encrypted,
    additionalData: credentialContext(server, connection),
  });

  if (payload.endpointConsent !== true) {
    throw new AssistantError("MCP endpoint consent is missing", ErrorType.AUTHORISATION_ERROR, 403);
  }

  return nativeMcpCredentialSchema.parse(payload.credential);
}
