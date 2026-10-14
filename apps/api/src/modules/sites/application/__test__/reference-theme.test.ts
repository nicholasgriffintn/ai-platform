import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

vi.mock("@ngriffin_uk/polychat-library-policy", () => ({ hasProEntitlement: () => true }));

import { readSiteReferenceTheme } from "../reference-theme";

const fetchMock = vi.fn<typeof fetch>();
const sandboxFetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();

function context(): ServiceContext {
  return {
    env: { SANDBOX_WORKER: { fetch: sandboxFetch } },
    requireUser: () => ({ id: 1 }),
  } as unknown as ServiceContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readSiteReferenceTheme", () => {
  it("keeps only the reference fonts Google Fonts serves", async () => {
    sandboxFetch.mockResolvedValue(
      Response.json({
        status: "captured",
        background: "#ffffff",
        foreground: "#111111",
        accents: [{ colour: "#635bff", weight: 100 }],
        headingFamily: '"Sohne", sans-serif',
        bodyFamily: "Inter, sans-serif",
      }),
    );
    fetchMock.mockImplementation(async (input) =>
      String(input).includes("family=Inter:")
        ? new Response("")
        : new Response("", { status: 400 }),
    );

    const theme = await readSiteReferenceTheme(context(), "https://stripe.com");

    expect(JSON.parse(String(sandboxFetch.mock.calls[0]?.[1].body))).toMatchObject({
      url: "https://stripe.com",
    });
    expect(theme).toMatchObject({ mode: "light", customFonts: { body: "Inter" } });
    expect(theme.customFonts?.heading).toBeUndefined();
    expect(theme.customPalette?.chroma).toBeGreaterThan(0.04);
  });

  it("fails clearly when the sandbox cannot read the page", async () => {
    sandboxFetch.mockResolvedValue(Response.json({ status: "unavailable" }));

    await expect(readSiteReferenceTheme(context(), "https://example.com")).rejects.toThrow(
      "Could not read colours and fonts from the reference site",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
