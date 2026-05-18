import { describe, expect, it } from "vitest";

import type { Message } from "~/types";
import { getCouncilRoutingState } from "../council";

function councilMessage(council: NonNullable<Message["data"]>["council"]): Message {
	return {
		id: crypto.randomUUID(),
		role: "assistant",
		content: "Council turn",
		data: { council },
	};
}

describe("getCouncilRoutingState", () => {
	it("deduplicates and filters the next speaker set from council routing", () => {
		const routing = getCouncilRoutingState(
			councilMessage({
				shouldContinue: true,
				nextMemberIds: ["architect", "architect", "unknown", "customer"],
			}),
			["architect", "customer"],
		);

		expect(routing).toEqual({
			shouldContinue: true,
			nextMemberIds: ["architect", "customer"],
		});
	});

	it("clears pending speakers when a council turn ends the debate", () => {
		const routing = getCouncilRoutingState(
			councilMessage({
				shouldContinue: false,
				nextMemberIds: ["architect"],
			}),
			["architect", "customer"],
		);

		expect(routing).toEqual({
			shouldContinue: false,
			nextMemberIds: [],
		});
	});
});
