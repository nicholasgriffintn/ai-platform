import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ImageModal } from "./ImageModal";

describe("ImageModal", () => {
	it("uses anonymous CORS by default", () => {
		render(<ImageModal src="https://example.com/image.png" alt="Example" />);

		expect(screen.getByAltText("Example")).toHaveAttribute("crossorigin", "anonymous");
	});

	it("can include credentials for private asset images", () => {
		render(
			<ImageModal
				src="http://localhost:8787/assets/asset-123"
				alt="Private asset"
				crossOrigin="use-credentials"
			/>,
		);

		expect(screen.getByAltText("Private asset")).toHaveAttribute("crossorigin", "use-credentials");
	});
});
