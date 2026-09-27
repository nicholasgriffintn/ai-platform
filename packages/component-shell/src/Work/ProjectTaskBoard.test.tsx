import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectTaskBoard } from "./ProjectTaskBoard.js";

const { createTask, startTask } = vi.hoisted(() => ({
  createTask: vi.fn(),
  startTask: vi.fn(),
}));

vi.mock("@ngriffin_uk/polychat-library-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-library-react")>()),
  useCapabilityCatalog: () => ({ data: undefined }),
  useTeammates: () => ({ teammates: [] }),
  useProjectTasks: () => ({
    tasks: [],
    flow: null,
    isLoading: false,
    error: null,
    create: { mutateAsync: createTask, isPending: false, error: null },
    start: { mutateAsync: startTask, isPending: false },
    accept: { mutateAsync: vi.fn(), isPending: false },
    saveFlow: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

vi.mock("./WorkDataContext.js", () => ({
  useWorkData: () => ({ projectQuery: {}, workspaceQuery: {} }),
}));

vi.mock("./ProjectHomeHeader.js", () => ({ ProjectHomeHeader: () => null }));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function TaskBoardRoute() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <>
      <output aria-label="Current query">{location.search}</output>
      <button type="button" onClick={() => void navigate("?new=1&keep=yes")}>
        Open from link
      </button>
      <ProjectTaskBoard workspaceId="workspace-1" projectId="project-1" />
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  createTask.mockResolvedValue({ task: { id: "created-task" } });
  startTask.mockResolvedValue({ task: { id: "created-task" } });
});

describe("ProjectTaskBoard creation", () => {
  it("opens the creation dialog when the URL changes on an already mounted board", () => {
    render(
      <MemoryRouter>
        <TaskBoardRoute />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open from link" }));
    expect(screen.getByRole("dialog", { name: "Add work to the teammate queue" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText("Current query")).toHaveTextContent("?keep=yes");
  });

  it("keeps the saved task when starting fails instead of leaving a duplicate submission", async () => {
    startTask.mockRejectedValueOnce(new Error("No credits available"));
    render(
      <MemoryRouter initialEntries={["/?new=1"]}>
        <TaskBoardRoute />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Objective" }), {
      target: { value: "Prepare the release note" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add and run" }));
    await waitFor(() => expect(startTask).toHaveBeenCalledWith("created-task"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(createTask).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(
      "Task saved, but could not be started: No credits available",
    );
  });

  it("keeps the draft when saving fails", async () => {
    createTask.mockRejectedValueOnce(new Error("Connection lost"));
    render(
      <MemoryRouter initialEntries={["/?new=1"]}>
        <TaskBoardRoute />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Objective" }), {
      target: { value: "Preserve this task" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save to backlog" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Connection lost"));
    expect(screen.getByRole("textbox", { name: "Objective" })).toHaveValue("Preserve this task");
    expect(startTask).not.toHaveBeenCalled();
  });
});
