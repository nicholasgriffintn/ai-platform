// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { ReplicateModelForm } from "./media/ReplicateModelForm";

it("preserves line breaks while editing URL lists and accepts required false values", () => {
  const onSubmit = vi.fn();

  render(
    <ReplicateModelForm
      model={{
        id: "test/model",
        name: "Model",
        description: "",
        modalitySignature: "image->image",
        modalityLabel: "Image",
        inputSchema: {
          fields: [
            { name: "images", type: "array", required: true },
            { name: "optimise", type: "boolean", required: true, default: false },
          ],
        },
      }}
      onSubmit={onSubmit}
      isSubmitting={false}
    />,
  );
  const input = screen.getByRole("textbox", { name: /images/ });

  fireEvent.change(input, { target: { value: "https://example.com/one.png\n" } });
  expect(input).toHaveProperty("value", "https://example.com/one.png\n");
  fireEvent.change(input, {
    target: { value: "https://example.com/one.png\n\n https://example.com/two.png \n" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Generate" }));
  expect(onSubmit).toHaveBeenCalledWith({
    images: ["https://example.com/one.png", "https://example.com/two.png"],
    optimise: false,
  });
});
