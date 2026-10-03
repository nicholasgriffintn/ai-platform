import type { RunnableTool } from "@ngriffin_uk/polychat-schemas";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToolForm } from "./ToolForm";

afterEach(cleanup);

const tool: RunnableTool = {
  id: "decide",
  name: "Decide",
  description: "Ask typed questions about state.",
  category: "Other",
  responseSchema: {},
  formSchema: {
    steps: [
      {
        id: "parameters",
        title: "Parameters",
        fields: [
          {
            id: "state",
            label: "State",
            type: "textarea",
            required: true,
            valueFormat: "json-or-text",
          },
          {
            id: "questions",
            label: "Questions",
            type: "textarea",
            required: true,
            valueFormat: "json",
          },
          { id: "note", label: "Note", type: "textarea", required: false },
        ],
      },
    ],
  },
};

const questions = { urgent: { type: "noul", instructions: "Does this need urgent attention?" } };

describe("ToolForm structured inputs", () => {
  it.each([
    ["Checkout has failed.", "Checkout has failed."],
    ['["Checkout has failed."]', ["Checkout has failed."]],
    ['{"incident":"Checkout has failed."}', { incident: "Checkout has failed." }],
  ])(
    "submits typed JSON fields and preserves ordinary text for state %s",
    async (state, expected) => {
      const onSubmit = vi.fn().mockResolvedValue({ success: true });

      render(<ToolForm tool={tool} onSubmit={onSubmit} onComplete={vi.fn()} />);
      fireEvent.change(screen.getByLabelText(/^State/), { target: { value: state } });
      fireEvent.change(screen.getByLabelText(/^Questions/), {
        target: { value: JSON.stringify(questions) },
      });
      fireEvent.change(screen.getByLabelText("Note"), { target: { value: '{"literal":"text"}' } });
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith({
          state: expected,
          questions,
          note: '{"literal":"text"}',
        }),
      );
    },
  );

  it("reports malformed JSON beside the field and allows correction before submitting", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ success: true });

    render(<ToolForm tool={tool} onSubmit={onSubmit} onComplete={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/^State/), {
      target: { value: "Checkout has failed." },
    });
    fireEvent.change(screen.getByLabelText(/^Questions/), { target: { value: "{broken}" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Questions must be a valid JSON object or array")).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/^Questions/), {
      target: { value: JSON.stringify(questions) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  });
});
