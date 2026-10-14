import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { registerApiRoutes } from "~/app";
import type { IEnv } from "~/types";

import { grammarViolations } from "./route-grammar";

const ROUTE_CEILING = 520;

function mountedRoutes(): string[] {
  const app = new Hono<{ Bindings: IEnv }>();

  registerApiRoutes(app);

  const routes = new Set<string>();

  for (const route of app.routes) {
    if (route.method !== "ALL") {
      routes.add(`${route.method} ${route.path}`);
    }
  }

  return [...routes].sort();
}

describe("route inventory", () => {
  const routes = mountedRoutes();

  it("keeps every resource route on the grammar", () => {
    expect(routes.flatMap(grammarViolations)).toEqual([]);
  });

  it("stays under the agreed route ceiling", () => {
    expect(routes.length).toBeLessThanOrEqual(ROUTE_CEILING);
  });
});
