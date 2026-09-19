import type { SiteProject } from "@ngriffin_uk/polychat-schemas";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteConversationTurn } from "../SiteConversationTurn.js";

const project: SiteProject = {
  title: "Signal/Noise",
  theme: { palette: "sunset", font: "sans", radius: "md", mode: "light" },
  pages: {
    home: {
      path: "/",
      title: "Home",
      root: "page",
      elements: {
        page: { type: "Page", props: {}, children: ["hearing-copy"] },
        "hearing-copy": {
          type: "Text",
          props: { text: "Captioning and hearing support" },
          children: [],
        },
      },
    },
  },
};

describe("SiteConversationTurn", () => {
  it("shows the selected element alongside the message sent with it", () => {
    render(
      <SiteConversationTurn
        prompt="Fix the contrast"
        project={project}
        target={{ pageId: "home", elementKey: "hearing-copy" }}
        entries={[]}
      />,
    );

    expect(screen.getByText("Selected Text")).toBeInTheDocument();
    expect(screen.getByText("home/hearing-copy")).toBeInTheDocument();
    expect(screen.getByText("Fix the contrast")).toBeInTheDocument();
  });
});
