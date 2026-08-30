import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ICON_LOADERS } from "./iconLoaders";
import { ModelIcon } from "./ModelIcon";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ModelIcon", () => {
  it("keeps the current fallback visible when a stale icon load resolves", async () => {
    const originalOpenAiLoader = ICON_LOADERS.openai;
    const originalClaudeLoader = ICON_LOADERS.claude;
    let resolveOpenAi:
      | ((module: Awaited<ReturnType<typeof originalOpenAiLoader>>) => void)
      | undefined;

    vi.spyOn(ICON_LOADERS, "openai").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveOpenAi = resolve;
        }),
    );
    vi.spyOn(ICON_LOADERS, "claude").mockImplementation(
      () => new Promise<Awaited<ReturnType<typeof originalClaudeLoader>>>(() => undefined),
    );

    const { rerender } = render(<ModelIcon modelName="gpt-5" provider="openai" />);

    rerender(<ModelIcon modelName="Claude 4" provider="anthropic" />);

    expect(screen.getByLabelText("Claude 4 initial")).toBeTruthy();
    expect(resolveOpenAi).toBeTypeOf("function");

    const openAiModule = await originalOpenAiLoader();

    await act(async () => {
      resolveOpenAi?.(openAiModule);
      await Promise.resolve();
    });

    expect(screen.getByLabelText("Claude 4 initial")).toBeTruthy();
  });
});
