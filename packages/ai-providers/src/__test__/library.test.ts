import { describe, expect, it, vi } from "vitest";

import { ProviderLibrary } from "../library";
import { ProviderRegistry } from "../registry";

interface ChatProvider {
  name: string;
  serial: number;
}

interface ImageProvider {
  name: string;
}

type Providers = {
  chat: ChatProvider;
  image: ImageProvider;
};

interface Context {
  suffix: string;
}

function createLibrary() {
  let serial = 0;
  const bootstrapChat = vi.fn((registry: ProviderRegistry<Providers, Context>) => {
    registry.register("chat", {
      name: "openai",
      aliases: ["oai"],
      metadata: { vendor: "OpenAI" },
      create: (context) => ({ name: `openai${context.suffix}`, serial: ++serial }),
    });
    registry.register("chat", {
      name: "anthropic",
      lifecycle: "transient",
      create: (context) => ({ name: `anthropic${context.suffix}`, serial: ++serial }),
    });
  });

  const library = new ProviderLibrary<Providers, Context>({
    bootstrappers: { chat: [bootstrapChat] },
  });

  return { library, bootstrapChat };
}

describe("ProviderLibrary", () => {
  it("bootstraps a category once, on first use", () => {
    const { library, bootstrapChat } = createLibrary();

    expect(bootstrapChat).not.toHaveBeenCalled();

    library.resolve("chat", "openai", { suffix: "-1" });
    library.resolve("chat", "OAI", { suffix: "-2" });
    library.list("chat");

    expect(bootstrapChat).toHaveBeenCalledTimes(1);
  });

  it("resolves aliases case-insensitively and honours lifecycle", () => {
    const { library } = createLibrary();

    const first = library.resolve("chat", "openai", { suffix: "" });
    const viaAlias = library.resolve("chat", "OAI", { suffix: "" });
    const transientA = library.resolve("chat", "anthropic", { suffix: "" });
    const transientB = library.resolve("chat", "anthropic", { suffix: "" });

    expect(viaAlias).toBe(first);
    expect(transientA).not.toBe(transientB);
  });

  it("reports unknown providers and categories as ProviderError", () => {
    const { library } = createLibrary();

    expect(() => library.resolve("chat", "missing", { suffix: "" })).toThrowError(
      expect.objectContaining({
        name: "ProviderError",
        code: "unknown_provider",
        category: "chat",
        providerName: "missing",
      }),
    );
    expect(() => library.resolve("image", "any", { suffix: "" })).toThrowError(
      expect.objectContaining({ code: "unknown_category", category: "image" }),
    );
  });

  it("rejects duplicate registrations within a category", () => {
    const { library } = createLibrary();

    library.resolve("chat", "openai", { suffix: "" });

    expect(() =>
      library.register("chat", { name: "OpenAI", create: () => ({ name: "dup", serial: 0 }) }),
    ).toThrowError(expect.objectContaining({ code: "duplicate_registration" }));
  });

  it("lets a later bootstrapper extend a category that already bootstrapped", () => {
    const { library } = createLibrary();

    library.resolve("chat", "openai", { suffix: "" });
    library.registerBootstrapper("chat", (registry) => {
      registry.register("chat", { name: "local", create: () => ({ name: "local", serial: 0 }) });
    });

    expect(library.listNames("chat")).toEqual(["anthropic", "local", "openai"]);
    expect(library.listNames("chat", { includeAliases: true })).toEqual([
      "anthropic",
      "local",
      "oai",
      "openai",
    ]);
  });

  it("passes every resolved instance through the decorator", () => {
    const seen: string[] = [];
    const library = new ProviderLibrary<Providers, Context>({
      bootstrappers: {
        image: [
          (registry) =>
            registry.register("image", { name: "fal", create: () => ({ name: "fal" }) }),
        ],
      },
      decorate: (category, providerName, instance, context) => {
        seen.push(`${category}:${providerName}:${context.suffix}`);

        return { ...instance, name: `${instance.name}!` };
      },
    });

    expect(library.resolve("image", "fal", { suffix: "x" })).toEqual({ name: "fal!" });
    expect(seen).toEqual(["image:fal:x"]);
  });

  it("hands provider errors to the host mapper", () => {
    const library = new ProviderLibrary<Providers, Context>({
      mapError: (error) => new Error(`host: ${error.code}`),
    });

    expect(() => library.resolve("chat", "openai", { suffix: "" })).toThrow(
      "host: unknown_category",
    );
  });

  it("lists summaries with metadata and aliases across categories", () => {
    const { library } = createLibrary();

    library.registerBootstrapper("image", (registry) => {
      registry.register("image", { name: "fal", create: () => ({ name: "fal" }) });
    });

    expect(library.list()).toEqual([
      { name: "anthropic", category: "chat", aliases: undefined, metadata: undefined },
      { name: "openai", category: "chat", aliases: ["oai"], metadata: { vendor: "OpenAI" } },
      { name: "fal", category: "image", aliases: undefined, metadata: undefined },
    ]);
    expect(library.has("chat", "OAI")).toBe(true);
    expect(library.has("chat", "nope")).toBe(false);
  });
});
