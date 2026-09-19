import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SITE_PROMPT_EXAMPLES } from "../site-examples.js";
import { SiteStarterPrompt } from "../SiteStarterPrompt.js";

describe("SitePromptComposer", () => {
  it("fills a controlled prompt without submitting and keeps it editable", () => {
    const onSubmit = vi.fn();

    render(<SiteStarterPrompt onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: SITE_PROMPT_EXAMPLES[0].title }));

    const textarea = screen.getByRole("textbox", { name: "Build" });

    expect(textarea).toHaveValue(SITE_PROMPT_EXAMPLES[0].prompt);
    expect(textarea).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(textarea, { target: { value: "A tailored brief" } });

    expect(textarea).toHaveValue("A tailored brief");
  });
});
