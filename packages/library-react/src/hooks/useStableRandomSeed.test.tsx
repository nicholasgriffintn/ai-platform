// @vitest-environment jsdom

import { act, cleanup } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";

import { useStableRandomSeed } from "./useStableRandomSeed.js";

function SeedProbe() {
  const seed = useStableRandomSeed();

  return <span data-seed>{seed}</span>;
}

afterEach(cleanup);

it("keeps the seed and markup stable across server hydration", async () => {
  const container = document.createElement("div");

  container.innerHTML = renderToString(<SeedProbe />);
  const serverSeed = container.querySelector("[data-seed]")?.textContent;
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  let unmount: (() => void) | undefined;

  await act(async () => {
    const root = hydrateRoot(container, <SeedProbe />);

    unmount = () => root.unmount();
  });

  expect(container.querySelector("[data-seed]")?.textContent).toBe(serverSeed);
  expect(consoleError).not.toHaveBeenCalled();

  unmount?.();
  consoleError.mockRestore();
});
