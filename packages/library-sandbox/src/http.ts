import { isRecord } from "@ngriffin_uk/polychat-utility-core";

export function errorResponse(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

export async function readJsonRecord(request: Request): Promise<Record<string, unknown> | null> {
  const value: unknown = await request.json().catch(() => null);

  return isRecord(value) ? value : null;
}

export function readBearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();

  return token.length > 0 ? token : null;
}
