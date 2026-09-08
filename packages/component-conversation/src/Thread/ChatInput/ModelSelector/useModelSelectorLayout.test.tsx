import { renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { useModelSelectorLayout } from "./useModelSelectorLayout";

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

it("anchors to the composer instead of copying viewport pixels into the footer", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const shell = document.createElement("div");

  shell.setAttribute("data-chat-input-shell", "");
  const wrapper = document.createElement("div");

  shell.append(wrapper);
  document.body.append(shell);
  Object.defineProperty(shell, "offsetHeight", { value: 200 });
  shell.getBoundingClientRect = () => new DOMRect(300, 400, 1200, 400);
  wrapper.getBoundingClientRect = () => new DOMRect(330, 700, 200, 50);

  const { result, rerender } = renderHook(
    ({ open, mounted }) => useModelSelectorLayout(open, mounted ? wrapper : null),
    {
      initialProps: { open: true, mounted: false },
    },
  );

  expect(result.current).toBeNull();
  rerender({ open: true, mounted: true });

  expect(result.current).toEqual({ container: shell, bottom: 50, maxHeight: 342 });
  expect(result.current).not.toHaveProperty("width");
  rerender({ open: false, mounted: true });
  expect(result.current).toBeNull();
});
