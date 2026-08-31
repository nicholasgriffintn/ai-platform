import type { RealtimeLiveProviderDescriptor } from "@ngriffin_uk/polychat-schemas";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { providerLibrary } from "~/lib/providers/library";
import * as apiKeyUtils from "~/lib/providers/utils/apiKeys";
import * as modelsService from "~/services/models";

import { listRealtimeLiveProviders, resolveRealtimeProviderReadiness } from "./catalogue";

const descriptor: RealtimeLiveProviderDescriptor = {
  id: "openai",
  order: 0,
  label: "OpenAI Realtime",
  shortLabel: "OpenAI",
  liveMode: "native",
  transport: "webrtc",
  sessionType: "realtime",
  inputModalities: ["audio"],
  outputModalities: ["audio"],
  description: "WebRTC voice agent",
  defaultModelId: "gpt-realtime-2",
};

describe("realtime provider catalogue", () => {
  afterEach(() => vi.restoreAllMocks());

  it("derives every public descriptor from a matching registry entry", () => {
    const registrations = providerLibrary.list("realtime");

    expect(registrations).toHaveLength(5);
    for (const registration of registrations) {
      expect(providerLibrary.realtime(registration.name).descriptor.id).toBe(registration.name);
    }
  });

  it("reports a configured provider with an accessible model as ready", () => {
    expect(
      resolveRealtimeProviderReadiness({
        descriptor,
        hasAccessibleModel: true,
        hasConfiguration: true,
      }),
    ).toEqual({
      available: true,
      readiness: "ready",
      availabilityReason: "OpenAI is ready.",
    });
  });

  it("distinguishes missing setup from an inaccessible model", () => {
    expect(
      resolveRealtimeProviderReadiness({
        descriptor,
        hasAccessibleModel: true,
        hasConfiguration: false,
      }),
    ).toMatchObject({ available: true, readiness: "setup_required" });
    expect(
      resolveRealtimeProviderReadiness({
        descriptor,
        hasAccessibleModel: false,
        hasConfiguration: true,
      }),
    ).toMatchObject({ available: false, readiness: "unavailable" });
  });

  it("projects registered providers using account model and credential readiness", async () => {
    const registrations = providerLibrary.list("realtime");
    const models: Awaited<ReturnType<typeof modelsService.listModels>> = Object.fromEntries(
      registrations.map(({ name }) => {
        const providerDescriptor = providerLibrary.realtime(name).descriptor;

        return [
          providerDescriptor.defaultModelId,
          {
            isDefault: false,
            isExecutable: true,
            matchingModel: providerDescriptor.defaultModelId,
            provider: providerDescriptor.id,
          },
        ];
      }),
    );
    const error = vi.fn();
    const context = {
      env: {},
      getLogger: () => ({ error }),
      requireUser: () => ({ id: 42 }),
      user: { id: 42 },
    } as unknown as ServiceContext;

    vi.spyOn(modelsService, "listModels").mockResolvedValue(models);
    vi.spyOn(apiKeyUtils, "hasUserProviderApiKey").mockResolvedValue(true);

    const catalogue = await listRealtimeLiveProviders(context);

    expect(catalogue).toHaveLength(registrations.length);
    expect(catalogue.every(({ readiness }) => readiness === "ready")).toBe(true);
    expect(catalogue.map(({ order }) => order)).toEqual([0, 1, 2, 3, 4]);
    expect(error).not.toHaveBeenCalled();
  });

  it("fails one provider closed without hiding other registered providers", async () => {
    const registrations = providerLibrary.list("realtime");
    const models: Awaited<ReturnType<typeof modelsService.listModels>> = Object.fromEntries(
      registrations.map(({ name }) => {
        const providerDescriptor = providerLibrary.realtime(name).descriptor;

        return [
          providerDescriptor.defaultModelId,
          {
            isDefault: false,
            isExecutable: true,
            matchingModel: providerDescriptor.defaultModelId,
            provider: providerDescriptor.id,
          },
        ];
      }),
    );
    const error = vi.fn();
    const context = {
      env: {},
      getLogger: () => ({ error }),
      requireUser: () => ({ id: 42 }),
      user: { id: 42 },
    } as unknown as ServiceContext;

    vi.spyOn(modelsService, "listModels").mockResolvedValue(models);
    vi.spyOn(apiKeyUtils, "hasUserProviderApiKey").mockImplementation(async ({ providerName }) => {
      if (providerName === "mistral") {
        throw new Error("credential lookup failed");
      }

      return true;
    });

    const catalogue = await listRealtimeLiveProviders(context);

    expect(catalogue).toHaveLength(registrations.length);
    expect(catalogue.find(({ id }) => id === "mistral")).toMatchObject({
      available: false,
      readiness: "unavailable",
    });
    expect(
      catalogue
        .filter(({ id }) => id !== "mistral")
        .every(({ readiness }) => readiness === "ready"),
    ).toBe(true);
    expect(error).toHaveBeenCalledWith(
      "Failed to resolve realtime provider readiness",
      expect.objectContaining({ provider: "mistral" }),
    );
  });
});
