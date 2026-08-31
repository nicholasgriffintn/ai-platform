import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { corsMiddleware } from "../cors";

describe("CORS middleware", () => {
  it("allows the idempotency header on browser preflight requests", async () => {
    const app = new Hono();

    app.use("*", corsMiddleware);
    app.post("/projects/:projectId/lean-proofs", (context) => context.body(null, 201));

    const response = await app.request(
      "https://localhost:8787/projects/project-1/lean-proofs",
      {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:5173",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type,idempotency-key",
        },
      },
      { ENV: "development" },
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    expect(response.headers.get("access-control-allow-headers")).toContain("Idempotency-Key");
  });
});
