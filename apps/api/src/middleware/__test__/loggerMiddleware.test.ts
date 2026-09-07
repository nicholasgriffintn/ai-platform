import type { Context, Next } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/utils/logger", () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
}));

function createMockContext(url = "http://example.com/test"): Context {
  return {
    req: {
      method: "GET",
      url,
      header: vi.fn(() => "Mozilla/5.0"),
    },
    res: {
      status: 200,
      headers: new Headers(),
    },
    get: vi.fn(() => null),
    set: vi.fn(),
  } as unknown as Context;
}

const mockNext = vi.fn() as ReturnType<typeof vi.fn> & Next;

describe("loggerMiddleware", () => {
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
  let loggerMiddleware: (context: Context, next: Next) => Promise<void>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockNext.mockReset();
    mockNext.mockImplementation(async () => undefined);
    vi.resetModules();

    mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };

    const { getLogger } = await import("~/utils/logger");

    vi.mocked(getLogger).mockReturnValue(mockLogger as never);
    ({ loggerMiddleware } = await import("../loggerMiddleware"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redacts single-use callback secrets from request logs", async () => {
    const context = createMockContext(
      "https://api.example.com/apps/connectors/composio/verify?session_uri=single-use-secret",
    );

    await loggerMiddleware(context, mockNext as Next);

    const logged = JSON.stringify(mockLogger.info.mock.calls);

    expect(logged).not.toContain("single-use-secret");
    expect(logged).toContain("%5Bredacted%5D");
  });

  it("redacts single-use callback secrets from failure logs as well", async () => {
    const context = createMockContext(
      "https://api.example.com/apps/connectors/composio/verify?session_uri=single-use-secret",
    );

    mockNext.mockRejectedValue(new Error("Test error"));

    await expect(loggerMiddleware(context, mockNext as Next)).rejects.toThrow("Test error");

    const logged = JSON.stringify(mockLogger.error.mock.calls);

    expect(logged).not.toContain("single-use-secret");
    expect(logged).toContain("%5Bredacted%5D");
  });

  it("rethrows a failing handler rather than swallowing it", async () => {
    const error = new Error("Test error");

    mockNext.mockRejectedValue(error);

    await expect(loggerMiddleware(createMockContext(), mockNext as Next)).rejects.toThrow(
      "Test error",
    );
  });

  it("rethrows a non-Error rejection unchanged", async () => {
    mockNext.mockRejectedValue("String error");

    await expect(loggerMiddleware(createMockContext(), mockNext as Next)).rejects.toBe(
      "String error",
    );
  });
});
