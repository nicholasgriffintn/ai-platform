import { encodeBase64Url } from "@ngriffin_uk/polychat-utility-server/base64url";

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export async function createPkcePair(): Promise<PkcePair> {
  const verifier = encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));

  return { verifier, challenge: encodeBase64Url(new Uint8Array(digest)) };
}
