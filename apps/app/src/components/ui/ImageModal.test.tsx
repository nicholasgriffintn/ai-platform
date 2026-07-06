import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ImageModal } from "./ImageModal";

describe("ImageModal", () => {
	it("uses the image description for the opener", () => {
		render(<ImageModal src="https://example.com/image.png" alt="Example" />);

		expect(screen.getByRole("button", { name: "View Example larger" })).toBeInTheDocument();
	});
});
