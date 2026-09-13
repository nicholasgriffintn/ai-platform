import {
  createMemorySurfaceStorage,
  createSurfaceAction,
} from "@ngriffin_uk/polychat-library-surface";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createPolychatQueryClient, createSurfaceControlsContext } from "./index.js";

describe("createPolychatQueryClient", () => {
  it("provides stable defaults while allowing host overrides", () => {
    const defaultClient = createPolychatQueryClient();

    expect(defaultClient.getDefaultOptions().queries?.staleTime).toBe(300_000);
    const hostClient = createPolychatQueryClient({
      defaultOptions: { queries: { staleTime: 10 } },
    });

    expect(hostClient.getDefaultOptions().queries?.staleTime).toBe(10);
  });
});

describe("surface controls context", () => {
  it("exposes typed host controls", () => {
    const { SurfaceControlsProvider, useSurfaceControls } = createSurfaceControlsContext<
      { route: string },
      { name: string }
    >();
    const controls = {
      navigate: createSurfaceAction((_intent: { route: string }) => undefined),
      openExternal: createSurfaceAction((_url: string) => undefined),
      copyText: createSurfaceAction((_text: string) => undefined),
      share: createSurfaceAction(() => undefined),
      selectFiles: createSurfaceAction(async () => [{ name: "note.txt" }]),
      notify: createSurfaceAction(() => undefined),
      storage: createMemorySurfaceStorage(),
    };

    function Consumer({ expected }: { expected: typeof controls }) {
      const surface = useSurfaceControls();

      return createElement("span", null, surface === expected ? "controls-match" : "mismatch");
    }

    const html = renderToStaticMarkup(
      createElement(
        SurfaceControlsProvider,
        { controls },
        createElement(Consumer, { expected: controls }),
      ),
    );

    expect(html).toContain("controls-match");
  });

  it("fails clearly when the provider is missing", () => {
    const { useSurfaceControls } = createSurfaceControlsContext();

    function Consumer() {
      useSurfaceControls();

      return null;
    }

    expect(() => renderToStaticMarkup(createElement(Consumer))).toThrow(
      "useSurfaceControls must be used within a SurfaceControlsProvider",
    );
  });
});
