import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { dataPage } from "../../test/data-page.js";
import { SiteRenderer } from "../SiteRenderer.js";

afterEach(cleanup);

it("renders refreshed source rows while preserving the local filter", async () => {
  const { rerender } = render(<SiteRenderer page={dataPage} boundState={{ "/tasks": [] }} />);

  fireEvent.change(screen.getByLabelText("Filter"), { target: { value: "Review" } });
  rerender(<SiteRenderer page={dataPage} boundState={{ "/tasks": [{ title: "Review" }] }} />);
  await screen.findByText("Review");
  expect(screen.getByDisplayValue("Review")).toBeTruthy();
});
