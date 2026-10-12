import { AIP_SIGNED_FIELDS, aipSignedPayload, type AipBundle } from "@ngriffin_uk/polychat-schemas";
import { base64ToBuffer } from "@ngriffin_uk/polychat-utility-server/base64";
import { deriveEd25519SigningKey, signEd25519 } from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { listPersonalMemoryDocuments } from "~/modules/memory-documents/application/memory-documents";
import { buildPortableBundle } from "~/modules/poly/domain/portable-bundle";

import { requirePolyContext } from "./home";

const SIGNING_KEY_PURPOSE = "polychat-aip-signing-v1";
const EXPORTER_VERSION = "1";

function requireExportConfiguration(context: ServiceContext): { secret: string; instance: string } {
  const secret = context.env.PRIVATE_KEY;
  const baseUrl = context.env.APP_BASE_URL;

  if (!secret || !baseUrl) {
    throw new AssistantError(
      "Exporting Poly is unavailable because signing is not configured",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  return { secret, instance: new URL(baseUrl).host };
}

export async function exportPolyBundle(
  context: ServiceContext,
  now = new Date(),
): Promise<AipBundle> {
  const user = context.requireUser();
  const { secret, instance } = requireExportConfiguration(context);
  const [polyContext, settings, documents] = await Promise.all([
    requirePolyContext(context),
    context.repositories.userSettings.getUserSettings(user.id),
    listPersonalMemoryDocuments(context),
  ]);
  const unsigned = buildPortableBundle({
    polyContextId: polyContext.id,
    instance,
    platformVersion: EXPORTER_VERSION,
    now,
    profile: {
      nickname: settings?.nickname,
      jobRole: settings?.job_role,
      traits: settings?.traits,
      preferences: settings?.preferences,
      defaultModel: settings?.default_model_id ?? settings?.default_model_tier,
    },
    documents,
    standingApprovals: polyContext.standingApprovals,
  });
  const key = await deriveEd25519SigningKey(base64ToBuffer(secret), SIGNING_KEY_PURPOSE);

  return {
    ...unsigned,
    signature: {
      algorithm: "Ed25519",
      public_key: key.publicKey,
      signed_fields: [...AIP_SIGNED_FIELDS],
      signature: await signEd25519(key.privateKey, aipSignedPayload(unsigned)),
      signed_at: now.toISOString(),
    },
  };
}
