import { parseBearerToken } from "@ngriffin_uk/polychat-utility-server/http";

export function isCsrfExempt(request: {
  path: string;
  authorization: string | undefined;
}): boolean {
  return request.path.startsWith("/webhooks") || Boolean(parseBearerToken(request.authorization));
}
