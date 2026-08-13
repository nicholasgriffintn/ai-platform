import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MusicTransportControls } from "./index";

afterEach(cleanup);

describe("MusicTransportControls", () => {
	it("explains why playback is unavailable without invoking transport callbacks", () => {
		const onPlay = vi.fn();
		const onStop = vi.fn();
		render(
			<MusicTransportControls
				isPlaying={false}
				canPlay={false}
				unavailableReason="Audio is unavailable in this host"
				onPlay={onPlay}
				onStop={onStop}
			/>,
		);

		const play = screen.getByRole("button", { name: "Play" });
		expect(play.hasAttribute("disabled")).toBe(true);
		expect(play.title).toBe("Audio is unavailable in this host");
		expect(screen.getByText("Audio is unavailable in this host")).toBeTruthy();
		fireEvent.click(play);
		expect(onPlay).not.toHaveBeenCalled();
		expect(onStop).not.toHaveBeenCalled();
	});

	it("maps controlled playback state to the matching callback", () => {
		const onPlay = vi.fn();
		const onStop = vi.fn();
		const { rerender } = render(
			<MusicTransportControls isPlaying={false} onPlay={onPlay} onStop={onStop} />,
		);
		fireEvent.click(screen.getByRole("button", { name: "Play" }));
		expect(onPlay).toHaveBeenCalledOnce();

		rerender(<MusicTransportControls isPlaying onPlay={onPlay} onStop={onStop} />);
		fireEvent.click(screen.getByRole("button", { name: "Stop" }));
		expect(onStop).toHaveBeenCalledOnce();
	});
});
