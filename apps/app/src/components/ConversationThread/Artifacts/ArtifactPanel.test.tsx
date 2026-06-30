import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ArtifactPanel } from "./ArtifactPanel";

describe("ArtifactPanel", () => {
	it("shows a contextual add-to-chat button after document text is selected", () => {
		const handleAddSelectionToChat = vi.fn();

		render(
			<ArtifactPanel
				artifact={{
					identifier: "case-for-gta-6",
					type: "text/markdown",
					title: "The Case for GTA 6",
					content: "# The case\n\nThis paragraph needs work.",
				}}
				onAddSelectionToChat={handleAddSelectionToChat}
				onClose={vi.fn()}
				isVisible={true}
			/>,
		);

		const editor = screen.getByLabelText("Document content") as HTMLTextAreaElement;
		editor.setSelectionRange(12, 38);
		fireEvent.select(editor);

		const addButton = screen.getByRole("button", { name: "Add selection to chat" });
		expect(addButton).toHaveAttribute("data-selection-action", "true");
		fireEvent.click(addButton);

		expect(handleAddSelectionToChat).toHaveBeenCalledWith({
			type: "artifact_selection",
			name: "selection from The Case for GTA 6",
			artifact: {
				identifier: "case-for-gta-6",
				type: "text/markdown",
				title: "The Case for GTA 6",
			},
			selectedText: "This paragraph needs work.",
			selectionStart: 12,
			selectionEnd: 38,
		});
	});

	it("does not show the contextual add action before selection", () => {
		render(
			<ArtifactPanel
				artifact={{
					identifier: "case-for-gta-6",
					type: "text/markdown",
					title: "The Case for GTA 6",
					content: "# The case\n\nThis paragraph needs work.",
				}}
				onAddSelectionToChat={vi.fn()}
				onClose={vi.fn()}
				isVisible={true}
			/>,
		);

		expect(screen.queryByRole("button", { name: "Add selection to chat" })).not.toBeInTheDocument();
	});

	it("applies markdown formatting controls to the document", () => {
		render(
			<ArtifactPanel
				artifact={{
					identifier: "case-for-gta-6",
					type: "text/markdown",
					title: "The Case for GTA 6",
					content: "# The case\n\nThis paragraph needs work.",
				}}
				onAddSelectionToChat={vi.fn()}
				onClose={vi.fn()}
				isVisible={true}
			/>,
		);

		const editor = screen.getByLabelText("Document content") as HTMLTextAreaElement;
		editor.setSelectionRange(12, 16);
		fireEvent.select(editor);
		fireEvent.click(screen.getByRole("button", { name: "Bold" }));

		expect(editor.value).toBe("# The case\n\n**This** paragraph needs work.");
	});

	it("renders an outline for document headings", () => {
		render(
			<ArtifactPanel
				artifact={{
					identifier: "case-for-gta-6",
					type: "text/markdown",
					title: "The Case for GTA 6",
					content: "# The case\n\n## The ask\n\nBody",
				}}
				onAddSelectionToChat={vi.fn()}
				onClose={vi.fn()}
				isVisible={true}
			/>,
		);

		expect(screen.getByRole("navigation", { name: "Document outline" })).toBeInTheDocument();
		expect(screen.getByText("The case")).toBeInTheDocument();
		expect(screen.getByText("The ask")).toBeInTheDocument();
	});
});
