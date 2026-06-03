import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Image } from "./Image";

describe("Image", () => {
	it("uses anonymous CORS by default", () => {
		render(<Image src="https://example.com/image.png" alt="Example" />);

		expect(screen.getByAltText("Example")).toHaveAttribute("crossorigin", "anonymous");
	});

	it("can include credentials for private asset images", () => {
		render(
			<Image
				src="http://localhost:8787/assets/asset-123"
				alt="Private asset"
				crossOrigin="use-credentials"
			/>,
		);

		expect(screen.getByAltText("Private asset")).toHaveAttribute("crossorigin", "use-credentials");
	});
});
