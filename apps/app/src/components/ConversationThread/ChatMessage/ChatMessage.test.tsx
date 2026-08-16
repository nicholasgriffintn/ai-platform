import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Message } from "~/types";
import { ChatMessage } from ".";

describe("ChatMessage", () => {
	it("omits the complete message row for hidden tool responses", () => {
		const message: Message = {
			id: "skill-result-1",
			role: "tool",
			name: "load_skill",
			content: "Model-only skill instructions",
			status: "success",
			log_id: "log-1",
			data: { responseType: "hidden" },
		};

		render(<ChatMessage conversationId="conversation-1" message={message} />);

		expect(screen.queryByRole("article")).not.toBeInTheDocument();
	});
});
