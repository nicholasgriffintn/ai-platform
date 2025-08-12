import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CodeExecutionRenderer } from "../CodeExecutionRenderer";

describe("CodeExecutionRenderer", () => {
  it("renders success badge with exit 0", () => {
    render(
      <CodeExecutionRenderer stdout="hello" stderr="" returnCode={0} />,
    );
    expect(screen.getByText(/Success \(exit 0\)/)).toBeInTheDocument();
    expect(screen.getByLabelText("Standard output")).toHaveTextContent("hello");
  });

  it("renders error badge with non-zero exit", () => {
    render(
      <CodeExecutionRenderer stdout="" stderr="boom" returnCode={2} />,
    );
    expect(screen.getByText(/Error \(exit 2\)/)).toBeInTheDocument();
  });

  it("toggles stderr visibility", () => {
    render(
      <CodeExecutionRenderer stdout="" stderr={"err-line"} returnCode={1} />,
    );
    const toggle = screen.getByRole("button", { name: /Show stderr/i });
    fireEvent.click(toggle);
    expect(screen.getByLabelText("Standard error")).toHaveTextContent(
      "err-line",
    );
    fireEvent.click(screen.getByRole("button", { name: /Hide stderr/i }));
    expect(screen.queryByLabelText("Standard error")).not.toBeInTheDocument();
  });
});