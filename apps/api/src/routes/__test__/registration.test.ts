import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { IEnv } from "~/types";

import { registerApiRoutes } from "../register";

describe("API route registration", () => {
  it("mounts user settings at the public /user path", () => {
    const app = new Hono<{ Bindings: IEnv }>();

    registerApiRoutes(app);

    expect(app.routes).toEqual(
      expect.arrayContaining([expect.objectContaining({ method: "PUT", path: "/user/settings" })]),
    );
  });
});
