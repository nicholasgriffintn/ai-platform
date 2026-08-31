import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IUser } from "~/types";
import { handleAIServiceError, normaliseApiError } from "~/utils/errors";

import audioRoutes from "../audio";

const handleTranscribeMock = vi.hoisted(() => vi.fn());

vi.mock("~/services/audio/transcribe", () => ({
  handleTranscribe: handleTranscribeMock,
}));

const user: IUser = {
  id: 42,
  name: "Test User",
  avatar_url: null,
  email: "test@example.com",
  github_username: null,
  company: null,
  site: null,
  location: null,
  bio: null,
  twitter_username: null,
  created_at: "2026-08-31T00:00:00.000Z",
  updated_at: "2026-08-31T00:00:00.000Z",
  setup_at: null,
  terms_accepted_at: null,
  plan_id: "pro",
};

function createApp(authenticated: boolean) {
  const app = new Hono<{ Variables: { user: IUser } }>();

  app.use("/audio/*", async (context, next) => {
    if (authenticated) {
      context.set("user", user);
    }

    await next();
  });
  app.route("/audio", audioRoutes);
  app.onError((error) => handleAIServiceError(normaliseApiError(error)));

  return app;
}

describe("audio transcription route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handleTranscribeMock.mockResolvedValue({ status: "success", content: "Hello" });
  });

  it("requires an authenticated user", async () => {
    const form = new FormData();

    form.append("audio", new File(["audio"], "recording.webm", { type: "audio/webm" }));
    const response = await createApp(false).request("https://api.polychat.test/audio/transcribe", {
      method: "POST",
      body: form,
    });

    expect(response.status).toBe(401);
    expect(handleTranscribeMock).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("accepts a file and returns the typed response", async () => {
    const form = new FormData();
    const file = new File(["audio"], "recording.webm", { type: "audio/webm" });

    form.append("audio", file);
    const response = await createApp(true).request("https://api.polychat.test/audio/transcribe", {
      method: "POST",
      body: form,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      response: { status: "success", content: "Hello" },
    });
    expect(handleTranscribeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: expect.objectContaining({ kind: "file" }),
        user,
      }),
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("rejects a URL form value before it reaches a provider", async () => {
    const form = new FormData();

    form.append("audio", "https://internal.example/metadata");
    const response = await createApp(true).request("https://api.polychat.test/audio/transcribe", {
      method: "POST",
      body: form,
    });

    expect(response.status).toBe(400);
    expect(handleTranscribeMock).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
