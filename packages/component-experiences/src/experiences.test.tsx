// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MusicTransportControls } from "./music";
import { TrainingStatusBadge } from "./training";

describe("experience subpaths", () => {
	it("keeps runtime actions host-controlled and presents status", () => {
		const onPlay = vi.fn();
		render(
			<>
				<MusicTransportControls isPlaying={false} onPlay={onPlay} onStop={vi.fn()} />
				<TrainingStatusBadge status="completed" />
			</>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Play" }));
		expect(onPlay).toHaveBeenCalledOnce();
		expect(screen.getByText("completed").getAttribute("data-tone")).toBe("success");
	});
});
