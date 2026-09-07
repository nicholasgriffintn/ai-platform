import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShellHostProvider, type ShellHost } from "../Host/ShellHostContext";
import { AppErrorBoundary } from "./AppErrorBoundary";

const host = {
  webBaseUrl: "https://polychat.test",
  openAssistant: vi.fn(),
  openSignIn: vi.fn(),
  signOut: vi.fn(),
  TaskNotificationSettings: () => null,
} satisfies ShellHost;

function Boom(): never {
  throw new Error("the perch gave way");
}

function LeaveButton() {
  const navigate = useNavigate();

  return (
    <button type="button" onClick={() => void navigate("/safe")}>
      Leave
    </button>
  );
}

function renderWindow() {
  return render(
    <MemoryRouter initialEntries={["/boom"]}>
      <ShellHostProvider host={host}>
        <LeaveButton />
        <AppErrorBoundary>
          <Routes>
            <Route path="/boom" element={<Boom />} />
            <Route path="/safe" element={<p>Back on the perch</p>} />
          </Routes>
        </AppErrorBoundary>
      </ShellHostProvider>
    </MemoryRouter>,
  );
}

describe("AppErrorBoundary", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the error rather than an empty window when a route throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    renderWindow();

    expect(screen.getByText("the perch gave way")).toBeInTheDocument();
  });

  it("lets the window leave the error behind rather than trapping it there", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    renderWindow();
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));

    expect(screen.getByText("Back on the perch")).toBeInTheDocument();
    expect(screen.queryByText("the perch gave way")).not.toBeInTheDocument();
  });
});
