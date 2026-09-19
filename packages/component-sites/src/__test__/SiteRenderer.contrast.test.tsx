import type { SitePage } from "@ngriffin_uk/polychat-schemas";
import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteRenderer } from "../SiteRenderer.js";

const page: SitePage = {
  path: "/",
  title: "Accessible programme",
  root: "page",
  elements: {
    page: { type: "Page", props: {}, children: ["section"] },
    section: {
      type: "Section",
      props: { background: "inverted" },
      children: ["heading", "card", "alert"],
    },
    heading: {
      type: "Heading",
      props: { text: "Access is part of the programme" },
      children: [],
    },
    card: {
      type: "Card",
      props: { variant: "outline" },
      children: ["body", "supporting"],
    },
    body: { type: "Text", props: { text: "Captioning is available." }, children: [] },
    supporting: {
      type: "Text",
      props: { text: "Ask the access team for details.", tone: "muted" },
      children: [],
    },
    alert: {
      type: "Alert",
      props: { title: "Reduced motion", description: "Animation is optional." },
      children: [],
    },
  },
};

describe("SiteRenderer contextual contrast", () => {
  it("lets text and transparent surfaces inherit an inverted section foreground", () => {
    const view = render(<SiteRenderer page={page} />);
    const screen = within(view.container);
    const section = screen.getByText("Access is part of the programme").closest("section");
    const card = screen.getByText("Captioning is available.").closest("div");
    const body = screen.getByText("Captioning is available.");
    const supporting = screen.getByText("Ask the access team for details.");
    const alertDescription = screen.getByText("Animation is optional.");

    expect(section?.classList.contains("bg-foreground")).toBe(true);
    expect(section?.classList.contains("text-background")).toBe(true);
    expect(card?.classList.contains("text-card-foreground")).toBe(false);
    expect(body.classList.contains("text-foreground")).toBe(false);
    expect(supporting.classList.contains("opacity-70")).toBe(true);
    expect(supporting.classList.contains("text-muted-foreground")).toBe(false);
    expect(alertDescription.classList.contains("opacity-70")).toBe(true);
    expect(alertDescription.classList.contains("text-muted-foreground")).toBe(false);
  });
});
