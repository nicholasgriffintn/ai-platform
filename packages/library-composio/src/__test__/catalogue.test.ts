import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { configuredComposioToolkits } from "../catalogue.js";

const providerIdsPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../schemas/src/generated/composio-recipe-connector-providers.generated.json",
);

describe("configured Composio toolkit catalogue", () => {
  it("keeps the generated provider contract in sync with the toolkit data", () => {
    const providerIds = JSON.parse(readFileSync(providerIdsPath, "utf8")) as string[];

    expect([...providerIds].sort()).toEqual(Object.keys(configuredComposioToolkits).sort());
  });
});
