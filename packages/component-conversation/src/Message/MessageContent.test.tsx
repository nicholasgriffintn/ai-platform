import { CustomResponseViewProvider } from "@ngriffin_uk/polychat-component-content";
import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MessageContent } from "./MessageContent";

afterEach(cleanup);

const assistantWithParts = (parts: unknown[]): Message =>
  ({
    id: "assistant-1",
    role: "assistant",
    content: "",
    parts,
  }) as unknown as Message;

describe("tool results carried as message parts", () => {
  it("renders an unregistered tool's records as a table rather than a raw dump", () => {
    render(
      <MessageContent
        message={assistantWithParts([
          {
            type: "tool_result",
            name: "mcp_tracker_list_runs",
            status: "success",
            content: "",
            data: {
              formattedName: "List runs",
              icon: "search",
              runs: [
                { id: "r1", status: "passed" },
                { id: "r2", status: "failed" },
              ],
            },
          },
        ])}
      />,
    );

    expect(screen.getByText("List runs")).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("cell", { name: "r1" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeTruthy();
  });

  it("renders a failed tool result as a failure, not as a success", () => {
    render(
      <MessageContent
        message={assistantWithParts([
          {
            type: "tool_result",
            name: "create_video",
            status: "error",
            content: "Generation failed",
            data: { formattedName: "Create Video", error: "Provider rejected the prompt" },
          },
        ])}
      />,
    );

    expect(screen.getByText("Provider rejected the prompt")).toBeTruthy();
    expect(screen.getByText("(error)")).toBeTruthy();
  });

  it("folds a call's arguments into its result rather than rendering a second box", () => {
    render(
      <MessageContent
        message={assistantWithParts([
          {
            type: "tool_use",
            name: "get_weather",
            toolCallId: "call-1",
            input: { location: "Bristol" },
          },
          {
            type: "tool_result",
            name: "get_weather",
            toolCallId: "call-1",
            status: "success",
            content: "Mild",
            data: { formattedName: "Get Weather" },
          },
        ])}
      />,
    );

    expect(screen.getAllByText("Get Weather")).toHaveLength(1);

    const toggle = screen.getByRole("button", { name: "Show tool arguments" });

    expect(screen.queryByText(/Bristol/)).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByText(/Bristol/)).toBeTruthy();
  });

  it("keeps an unanswered call visible while it runs", () => {
    render(
      <MessageContent
        message={assistantWithParts([
          {
            type: "tool_use",
            name: "research",
            toolCallId: "call-2",
            input: { query: "kingfishers" },
          },
        ])}
      />,
    );

    expect(screen.getByText("research")).toBeTruthy();
    expect(screen.getByText("(in_progress)")).toBeTruthy();
  });

  it("suppresses a tool result the API marked hidden", () => {
    const { container } = render(
      <MessageContent
        message={assistantWithParts([
          {
            type: "tool_result",
            name: "load_skill",
            status: "success",
            content: "",
            data: { responseType: "hidden", formattedName: "Load Skill" },
          },
        ])}
      />,
    );

    expect(container.textContent).not.toContain("Load Skill");
  });

  it("reaches a registered view through the renderer id the tool declared", () => {
    const renderCustom = vi.fn(() => <p>Custom rendering</p>);

    render(
      <CustomResponseViewProvider views={{ my_view: renderCustom }}>
        <MessageContent
          message={assistantWithParts([
            {
              type: "tool_result",
              name: "mcp_anything_at_all",
              status: "success",
              content: "",
              data: { renderer: "my_view", formattedName: "Anything", value: 1 },
            },
          ])}
        />
      </CustomResponseViewProvider>,
    );

    expect(screen.getByText("Custom rendering")).toBeTruthy();
    expect(renderCustom).toHaveBeenCalledOnce();
  });
});
