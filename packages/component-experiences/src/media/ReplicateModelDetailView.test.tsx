import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReplicateModelDetailView } from "./ReplicateModelDetailView";

describe("ReplicateModelDetailView", () => {
  it("omits unavailable variable pricing without hiding the model reference", () => {
    render(
      <ReplicateModelDetailView
        model={{
          name: "Wan 3.0",
          reference: "https://replicate.com/alibaba/wan-3",
        }}
        form={<div>Form</div>}
      />,
    );

    expect(screen.queryByText(/Cost:/)).toBeNull();
    expect(screen.getByRole("link", { name: "View documentation" }).getAttribute("href")).toBe(
      "https://replicate.com/alibaba/wan-3",
    );
  });

  it("shows a fixed per-run cost when the catalogue provides one", () => {
    render(
      <ReplicateModelDetailView
        model={{ name: "Imagen 4", costPerRun: 0.04 }}
        form={<div>Form</div>}
      />,
    );

    expect(screen.getByText("Cost: $0.04 per run")).toBeTruthy();
  });
});
