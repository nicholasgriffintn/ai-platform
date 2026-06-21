import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import {
	TokenizedComposerInput,
	type TokenizedComposerInputHandle,
} from "./TokenizedComposerInput";

describe("TokenizedComposerInput", () => {
	it("renders tokens at their text insertion point", () => {
		render(
			<TokenizedComposerInput
				id="message-input"
				value="Ask @Daily Weather today"
				tokens={[
					{
						id: "action:daily-weather",
						kind: "action",
						label: "Daily Weather",
						position: 4,
					},
				]}
				placeholder="Ask me anything..."
				ariaLabel="Message input"
				onChange={vi.fn()}
				onCursorPositionChange={vi.fn()}
				onTokenPositionsChange={vi.fn()}
				onKeyDown={vi.fn()}
			/>,
		);

		const textbox = screen.getByRole("textbox", { name: "Message input" });
		const token = screen.getByTestId("composer-token-part");

		expect(textbox.childNodes[0]?.textContent).toBe("Ask ");
		expect(token.textContent).toBe("@Daily Weather");
		expect(textbox.childNodes[2]?.textContent).toBe(" today");
		expect(textbox).toHaveTextContent("Ask @Daily Weather today");
		expect(screen.queryByText("Ask me anything...")).not.toBeInTheDocument();
	});

	it("keeps placeholder text outside the editable value", () => {
		const onChange = vi.fn();

		render(
			<TokenizedComposerInput
				id="message-input"
				value=""
				placeholder="Ask me anything..."
				ariaLabel="Message input"
				onChange={onChange}
				onCursorPositionChange={vi.fn()}
				onTokenPositionsChange={vi.fn()}
				onKeyDown={vi.fn()}
			/>,
		);

		const textbox = screen.getByRole("textbox", { name: "Message input" });
		expect(screen.getByText("Ask me anything...")).toBeInTheDocument();
		expect(textbox.textContent).toBe("");

		fireEvent.input(textbox);
		expect(onChange).toHaveBeenCalledWith("");
	});

	it("focuses the editable surface when clicked", () => {
		render(
			<TokenizedComposerInput
				id="message-input"
				value=""
				placeholder="Ask me anything..."
				ariaLabel="Message input"
				onChange={vi.fn()}
				onCursorPositionChange={vi.fn()}
				onTokenPositionsChange={vi.fn()}
				onKeyDown={vi.fn()}
			/>,
		);

		const textbox = screen.getByRole("textbox", { name: "Message input" });
		fireEvent.mouseDown(textbox.parentElement as HTMLElement);

		expect(document.activeElement).toBe(textbox);
	});

	it("moves the cursor after a token inserted at the current text position", () => {
		const inputRef = createRef<TokenizedComposerInputHandle>();
		const onCursorPositionChange = vi.fn();
		const props = {
			id: "message-input",
			value: "ask @PostHog about signups",
			placeholder: "Ask me anything...",
			ariaLabel: "Message input",
			onChange: vi.fn(),
			onCursorPositionChange,
			onTokenPositionsChange: vi.fn(),
			onKeyDown: vi.fn(),
		};
		const { rerender } = render(<TokenizedComposerInput ref={inputRef} {...props} />);

		inputRef.current?.focus();
		inputRef.current?.setCursorPosition(12);
		rerender(
			<TokenizedComposerInput
				ref={inputRef}
				{...props}
				tokens={[
					{
						id: "connector:posthog",
						kind: "action",
						label: "PostHog",
						position: 4,
					},
				]}
			/>,
		);

		const textbox = screen.getByRole("textbox", { name: "Message input" });
		const selection = window.getSelection();

		expect(selection?.anchorNode).toBe(textbox);
		expect(selection?.anchorOffset).toBe(2);
		expect(onCursorPositionChange).toHaveBeenLastCalledWith(12);
	});

	it("counts token text before the cursor when reporting logical cursor position", () => {
		const inputRef = createRef<TokenizedComposerInputHandle>();

		render(
			<TokenizedComposerInput
				id="message-input"
				ref={inputRef}
				value="hey @Daily Weather and"
				tokens={[
					{
						id: "action:daily-weather",
						kind: "action",
						label: "Daily Weather",
						position: 4,
					},
				]}
				placeholder="Ask me anything..."
				ariaLabel="Message input"
				onChange={vi.fn()}
				onCursorPositionChange={vi.fn()}
				onTokenPositionsChange={vi.fn()}
				onKeyDown={vi.fn()}
			/>,
		);

		inputRef.current?.focus();
		inputRef.current?.setCursorPosition("hey @Daily Weather and".length);

		expect(inputRef.current?.getCursorPosition()).toBe("hey @Daily Weather and".length);
	});

	it("reads edited text without folding token labels into the prompt", () => {
		const onChange = vi.fn();
		const onTokenPositionsChange = vi.fn();

		render(
			<TokenizedComposerInput
				id="message-input"
				value="Ask @Daily Weather today"
				tokens={[
					{
						id: "action:daily-weather",
						kind: "action",
						label: "Daily Weather",
						position: 4,
					},
				]}
				placeholder="Ask me anything..."
				ariaLabel="Message input"
				onChange={onChange}
				onCursorPositionChange={vi.fn()}
				onTokenPositionsChange={onTokenPositionsChange}
				onKeyDown={vi.fn()}
			/>,
		);

		const textbox = screen.getByRole("textbox", { name: "Message input" });
		textbox.childNodes[0].textContent = "Ask me ";
		fireEvent.input(textbox);

		expect(onChange).toHaveBeenCalledWith("Ask me @Daily Weather today");
		expect(onTokenPositionsChange).toHaveBeenCalledWith([
			{ id: "action:daily-weather", position: 7 },
		]);
	});
});
