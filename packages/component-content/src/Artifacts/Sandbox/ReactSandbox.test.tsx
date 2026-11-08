import { afterEach, describe, expect, it, vi } from "vitest";

import { prepareReactArtifactDocument } from "./ReactSandbox";

function renderInRuntime(document: string) {
  const inlineScript = [...document.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)?.[1] ?? "";
  const render = vi.fn();

  globalThis.document.body.innerHTML = '<div id="root"></div>';
  vi.stubGlobal("React", { createElement: (component: unknown) => component });
  vi.stubGlobal("ReactDOM", { createRoot: () => ({ render }) });
  new Function(inlineScript)();

  return {
    rendered: render.mock.calls[0]?.[0] as unknown,
    error: globalThis.document.querySelector(".error-container")?.textContent ?? null,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.document.body.innerHTML = "";
});

describe("prepareReactArtifactDocument", () => {
  it("still rejects imports it cannot provide", async () => {
    const document = await prepareReactArtifactDocument(
      'import _ from "lodash";\nexport default function Widget() { return _.noop(); }',
      undefined,
    );

    expect(renderInRuntime(document).error).toContain('cannot import "lodash"');
  });

  it("cannot be closed early by a script tag inside the component", async () => {
    const document = await prepareReactArtifactDocument(
      'export default function Sneaky() { return <p>{"</script><script>alert(1)</script>"}</p>; }',
      undefined,
    );

    expect(document).not.toContain("</script><script>alert(1)");
  });
});
