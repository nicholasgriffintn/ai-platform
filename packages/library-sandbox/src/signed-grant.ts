import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { decodeBase64Url, encodeBase64Url } from "@ngriffin_uk/polychat-utility-server/base64url";
import { hmacSha256, verifyHmacSha256 } from "@ngriffin_uk/polychat-utility-server/crypto";

export interface SignedGrantClaims {
  exp: number;
}

export async function signGrant<TClaims extends SignedGrantClaims>(
  secret: string,
  claims: TClaims,
): Promise<string> {
  const encoded = encodeBase64Url(new TextEncoder().encode(JSON.stringify(claims)));
  const signature = await hmacSha256(secret, encoded);

  return `${encoded}.${encodeBase64Url(signature)}`;
}

export async function verifyGrant<TClaims extends SignedGrantClaims>(
  secret: string,
  token: string,
  accept: (claims: Record<string, unknown>) => TClaims | null,
  now: () => number = Date.now,
): Promise<TClaims | null> {
  const [encoded, signature, ...rest] = token.split(".");

  if (!encoded || !signature || rest.length > 0) {
    return null;
  }

  let signatureBytes: Uint8Array;

  try {
    signatureBytes = decodeBase64Url(signature);
  } catch {
    return null;
  }

  if (!(await verifyHmacSha256(secret, encoded, signatureBytes))) {
    return null;
  }

  try {
    const claims: unknown = JSON.parse(new TextDecoder().decode(decodeBase64Url(encoded)));

    if (!isRecord(claims) || typeof claims.exp !== "number" || claims.exp <= now()) {
      return null;
    }

    return accept(claims);
  } catch {
    return null;
  }
}
