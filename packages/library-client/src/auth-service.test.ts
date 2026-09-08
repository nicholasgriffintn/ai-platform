import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  getApiKey: vi.fn(),
  setApiKey: vi.fn(),
}));

vi.mock("./fetch-wrapper.js", () => ({ fetchApi: mocks.fetch }));
vi.mock("./api-key.js", () => ({
  apiKeyService: { getApiKey: mocks.getApiKey, setApiKey: mocks.setApiKey },
}));

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.resetModules();
});

it("refreshes at the scheduled margin and keeps renewing during a long idle session", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-08T12:00:00Z"));
  let token = "";

  mocks.getApiKey.mockImplementation(async () => token);
  mocks.setApiKey.mockImplementation(async (value: string) => {
    token = value;
  });
  mocks.fetch.mockImplementation(async () =>
    Response.json({ token: `token-${mocks.fetch.mock.calls.length}`, expires_in: 900 }),
  );
  const { authService } = await import("./auth-service.js");

  expect(await authService.getToken()).toBe("token-1");
  await vi.advanceTimersByTimeAsync(12 * 60 * 1000);
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  expect(await authService.getToken()).toBe("token-2");
  await vi.advanceTimersByTimeAsync(12 * 60 * 1000);
  expect(mocks.fetch).toHaveBeenCalledTimes(3);
  expect(await authService.getToken()).toBe("token-3");
});
