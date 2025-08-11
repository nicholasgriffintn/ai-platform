import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

vi.mock("~/services/audio/transcribe", () => ({
  handleTranscribe: vi.fn(async () => ({
    status: "success",
    content: "hello world transcript",
    data: {},
  })),
}));

vi.mock("~/repositories", () => ({
  RepositoryManager: {
    getInstance: vi.fn(() => ({
      appData: {
        createAppDataWithItem: vi.fn(async (_uid: any, _appId: any, id: string) => ({ id })),
        getAppDataById: vi.fn(),
      },
    })),
  },
}));

vi.mock("~/lib/models", () => ({
  getAuxiliaryModel: vi.fn(async () => ({ model: "gpt-4o-mini", provider: "openai" })),
}));

vi.mock("~/lib/providers/factory", () => ({
  AIProviderFactory: {
    getProvider: vi.fn(() => ({
      getResponse: vi.fn(async () => ({ response: "Generated summary" })),
    })),
  },
}));

import { handleVideoToNotes } from "../../video/notes";

describe("handleVideoToNotes", () => {
  const mockEnv: IEnv = {} as IEnv;
  const mockUser: IUser = { id: "user-1" } as unknown as IUser;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws if missing url", async () => {
    await expect(
      handleVideoToNotes({ env: mockEnv, user: mockUser, url: "" }),
    ).rejects.toThrow(new AssistantError("Missing video URL", ErrorType.PARAMS_ERROR));
  });

  it("creates note from youtube url", async () => {
    const res = await handleVideoToNotes({
      env: mockEnv,
      user: mockUser,
      url: "https://www.youtube.com/watch?v=test",
      generateSummary: true,
    });

    expect(res.status).toBe("success");
    expect((res.data as any)?.noteId).toBeTruthy();
  });
});