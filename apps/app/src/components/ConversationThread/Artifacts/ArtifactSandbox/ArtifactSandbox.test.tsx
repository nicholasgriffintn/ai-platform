import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ArtifactSandbox } from ".";

vi.mock("./HtmlSandbox", () => ({
	HtmlSandbox: () => <div>HTML sandbox</div>,
}));

vi.mock("./JavaScriptSandbox", () => ({
	JavaScriptSandbox: () => <div>JavaScript sandbox</div>,
}));

vi.mock("./ReactSandbox", () => ({
	ReactSandbox: () => <div>React sandbox</div>,
}));

vi.mock("./SvgSandbox", () => ({
	SvgSandbox: () => <div>SVG sandbox</div>,
}));

describe("ArtifactSandbox", () => {
	it("routes type-only SVG artifacts to the SVG sandbox", () => {
		render(
			<ArtifactSandbox
				code={{
					identifier: "logo",
					type: "image/svg+xml",
					title: "Logo",
					content: "<svg />",
				}}
				setPreviewError={vi.fn()}
				iframeKey={0}
			/>,
		);

		expect(screen.getByText("SVG sandbox")).toBeInTheDocument();
	});
});
