import type { SitePage } from "@ngriffin_uk/polychat-schemas";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SiteRenderer } from "../SiteRenderer.js";

const page: SitePage = {
  path: "/",
  title: "Common Ground",
  root: "page",
  elements: {
    page: {
      type: "Page",
      props: {},
      children: ["steps", "image", "tabs", "footer"],
    },
    steps: {
      type: "Steps",
      props: {
        headline: "A practical route",
        items: [
          {
            title: "Start with a conversation",
            description: "Tell us what you need.",
          },
        ],
      },
      style: { surface: "primary" },
      children: [],
    },
    image: {
      type: "Image",
      props: { alt: "A climate-ready front garden", aspect: "wide" },
      children: [],
    },
    tabs: {
      type: "Tabs",
      props: {
        tabs: [{ label: "Garden visit", value: "visit" }],
        defaultValue: "visit",
      },
      children: ["panel"],
    },
    panel: {
      type: "Card",
      props: { title: "Request a garden visit" },
      children: [],
    },
    footer: {
      type: "Footer",
      props: {
        brand: "Common Ground",
        tagline: "Practical planting for climate-ready neighbourhoods.",
        columns: [
          { title: "Explore", links: [{ label: "Our work", href: "/work" }] },
          {
            title: "Volunteer",
            links: [{ label: "Garden visits", href: "/visit" }],
          },
        ],
        copyright: "© Common Ground",
      },
      children: [],
    },
  },
};

describe("SiteRenderer presentation safeguards", () => {
  afterEach(cleanup);

  it("renders styled content once and marks contrast surfaces", () => {
    const view = render(<SiteRenderer page={page} />);

    expect(screen.getAllByText("Start with a conversation")).toHaveLength(1);
    expect(
      view.container
        .querySelector('[data-site-style-for="steps"]')
        ?.classList.contains("site-surface-contrast"),
    ).toBe(true);
  });

  it("lets media fill stretched layouts and gives tabs internal breathing room", () => {
    render(<SiteRenderer page={page} />);

    expect(
      screen
        .getByRole("img", { name: "A climate-ready front garden" })
        .classList.contains("h-full"),
    ).toBe(true);
    expect(screen.getByRole("tablist").parentElement?.classList.contains("pt-2")).toBe(true);
    expect(screen.getByRole("tabpanel").classList.contains("min-w-0")).toBe(true);
  });

  it("keeps footer colour contextual and lays link groups out independently", () => {
    render(<SiteRenderer page={page} />);

    expect(
      screen.getByText("Common Ground").closest("footer")?.classList.contains("bg-transparent"),
    ).toBe(true);
    expect(
      screen.getByText("Explore").parentElement?.parentElement?.classList.contains("grid-cols-2"),
    ).toBe(true);
    expect(
      screen
        .getByText("Practical planting for climate-ready neighbourhoods.")
        .classList.contains("opacity-70"),
    ).toBe(true);
  });
});
