import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ArtifactInlinePreview } from "./ArtifactInlinePreview";

vi.mock("./ArtifactSandbox/index", () => ({
	ArtifactSandbox: ({
		css,
	}: {
		css?: {
			identifier: string;
		};
	}) => <div data-testid="inline-preview-css">{css?.identifier || "none"}</div>,
}));

describe("ArtifactInlinePreview", () => {
	it("passes type-only CSS artifacts into inline previews", async () => {
		render(
			<ArtifactInlinePreview
				artifact={{
					identifier: "page",
					type: "text/html",
					title: "Page",
					content: "<main>Hello</main>",
				}}
				artifacts={[
					{
						identifier: "styles",
						type: "text/css",
						title: "Styles",
						content: "main { color: red; }",
					},
				]}
			/>,
		);

		expect(await screen.findByTestId("inline-preview-css")).toHaveTextContent("styles");
	});
});
