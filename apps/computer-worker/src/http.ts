export function errorResponse(status: number, error: string): Response {
  return Response.json({ error }, { status });
}
