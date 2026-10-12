import {
  aipBundleSchema,
  aipSignedPayload,
  type TeammateContext,
} from "@ngriffin_uk/polychat-schemas";
import { base64ToBuffer, bufferToBase64 } from "@ngriffin_uk/polychat-utility-server/base64";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { listPersonalMemoryDocuments } from "~/modules/memory-documents/application/memory-documents";

import { requirePolyContext } from "../home";
import { exportPolyBundle } from "../portable-bundle";

vi.mock("../home", () => ({ requirePolyContext: vi.fn() }));
vi.mock("~/modules/memory-documents/application/memory-documents", () => ({
  listPersonalMemoryDocuments: vi.fn(),
}));

const now = new Date("2026-10-12T12:00:00.000Z");

function createContext(env: Record<string, string | undefined>) {
  return {
    env,
    requireUser: vi.fn().mockReturnValue({ id: 7 }),
    repositories: {
      userSettings: {
        getUserSettings: vi.fn().mockResolvedValue({
          nickname: "Sam",
          job_role: "Platform lead",
          traits: "dry, brief",
          preferences: "British English",
          default_model_id: null,
          default_model_tier: "balanced",
        }),
      },
    },
  } as unknown as ServiceContext;
}

beforeEach(() => {
  vi.mocked(requirePolyContext).mockResolvedValue({
    id: "context-1",
    standingApprovals: [
      {
        toolName: "gmail_label",
        destination: "gmail:sam@example.com",
        grantedAt: "2026-10-01T00:00:00.000Z",
        expiresAt: "2026-11-01T00:00:00.000Z",
      },
      {
        toolName: "calendar_create",
        destination: "calendar:primary",
        grantedAt: "2026-09-01T00:00:00.000Z",
        expiresAt: "2026-10-01T00:00:00.000Z",
      },
    ],
  } as TeammateContext);
  vi.mocked(listPersonalMemoryDocuments).mockResolvedValue([
    {
      id: "doc-1",
      name: "projects",
      content: "Migrating billing to credits.",
      revision: 3,
      scopeType: "personal",
      scopeId: "7",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
  ]);
});

describe("exportPolyBundle", () => {
  it("signs what it exports so tampering is detectable", async () => {
    const bundle = aipBundleSchema.parse(
      await exportPolyBundle(
        createContext({
          PRIVATE_KEY: bufferToBase64(new Uint8Array(32).fill(3)),
          APP_BASE_URL: "https://polychat.app",
        }),
        now,
      ),
    );
    const { signature, ...unsigned } = bundle;
    const publicKey = await crypto.subtle.importKey(
      "raw",
      base64ToBuffer(signature.public_key),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const verify = (payload: string) =>
      crypto.subtle.verify(
        { name: "Ed25519" },
        publicKey,
        base64ToBuffer(signature.signature),
        new TextEncoder().encode(payload),
      );

    expect(bundle.exported_by.instance).toBe("polychat.app");
    expect(await verify(aipSignedPayload(unsigned))).toBe(true);
    expect(
      await verify(
        aipSignedPayload({
          ...unsigned,
          memory: { ...unsigned.memory, persistent: [] },
        }),
      ),
    ).toBe(false);
  });

  it("carries memory and live approvals, never expired grants", async () => {
    const bundle = await exportPolyBundle(
      createContext({
        PRIVATE_KEY: bufferToBase64(new Uint8Array(32).fill(3)),
        APP_BASE_URL: "https://polychat.app",
      }),
      now,
    );

    expect(bundle.memory.persistent.map((entry) => entry.key)).toEqual([
      "user_context",
      "projects",
    ]);
    expect(bundle.learned_behaviors.workflow_preferences.auto_approves).toEqual([
      "gmail_label on gmail:sam@example.com",
    ]);
    expect(bundle.configuration.model_preferences).toEqual({ default: "balanced" });
  });

  it("refuses to export unsigned", async () => {
    await expect(
      exportPolyBundle(createContext({ APP_BASE_URL: "https://polychat.app" }), now),
    ).rejects.toMatchObject({ statusCode: 503 });
  });
});
