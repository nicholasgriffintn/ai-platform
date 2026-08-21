import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TemplateView } from "./TemplateView";

/**
 * Template text is authored by the tool schema, but the values interpolated into it come from web
 * pages, third-party APIs and MCP servers. None of them may reach the DOM as markup.
 */
describe("TemplateView escaping", () => {
  it("renders an injected element as text, not as markup", () => {
    const { container } = render(
      <TemplateView
        template="<div>{{title}}</div>"
        data={{ title: '<img src=x onerror="globalThis.pwned = true">' }}
      />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="globalThis.pwned = true">');
  });

  it("escapes values interpolated into an attribute", () => {
    const { container } = render(
      <TemplateView
        template='<button data-option="{{choice}}">Pick</button>'
        data={{ choice: '"><script>globalThis.pwned = true</script>' }}
      />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelectorAll("button")).toHaveLength(1);
  });

  it("escapes values interpolated inside an each block", () => {
    const { container } = render(
      <TemplateView
        template="{{#each items}}<span>{{this.label}}</span>{{/each}}"
        data={{ items: [{ label: "<script>globalThis.pwned = true</script>" }] }}
      />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>");
  });

  it("renders the json helper rather than dropping the expression", () => {
    const { container } = render(
      <TemplateView template="<pre>{{json data.context}}</pre>" data={{ context: { id: 7 } }} />,
    );

    expect(container.textContent).toContain('"id": 7');
  });

  it("reports a missing template instead of rendering an empty surface", () => {
    render(<TemplateView data={{}} />);

    expect(screen.getByText("No response is available.")).toBeVisible();
  });
});
