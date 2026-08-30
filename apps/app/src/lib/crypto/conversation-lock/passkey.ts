import { randomBytes } from "@ngriffin_uk/auth-crypto";
import { decodeBase64Url, encodeBase64Url } from "@ngriffin_uk/auth-encoding";

import { toArrayBuffer, toBytes } from "../bytes";

const PRF_SALT_BYTES = 32;
const CHALLENGE_BYTES = 32;

export class PasskeyPrfUnavailableError extends Error {
  constructor() {
    super("This passkey cannot encrypt. Use a password instead.");
    this.name = "PasskeyPrfUnavailableError";
  }
}

export interface PasskeySecret {
  credentialId: string;
  output: Uint8Array;
}

export function isPasskeyEncryptionSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.credentials)
  );
}

export function createPrfSalt(): string {
  return encodeBase64Url(randomBytes(PRF_SALT_BYTES), false);
}

export async function evaluatePasskeyPrf(params: {
  salt: string;
  credentialId?: string | null;
}): Promise<PasskeySecret> {
  if (!isPasskeyEncryptionSupported()) {
    throw new PasskeyPrfUnavailableError();
  }

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: toArrayBuffer(randomBytes(CHALLENGE_BYTES)),
      userVerification: "required",
      allowCredentials: params.credentialId
        ? [
            {
              type: "public-key",
              id: toArrayBuffer(decodeBase64Url(params.credentialId)),
            },
          ]
        : undefined,
      extensions: {
        prf: { eval: { first: toArrayBuffer(decodeBase64Url(params.salt)) } },
      },
    },
  })) as PublicKeyCredential | null;

  if (!assertion) {
    throw new PasskeyPrfUnavailableError();
  }

  const first = assertion.getClientExtensionResults().prf?.results?.first;

  if (!first) {
    throw new PasskeyPrfUnavailableError();
  }

  return {
    credentialId: encodeBase64Url(toBytes(assertion.rawId), false),
    output: toBytes(first),
  };
}
