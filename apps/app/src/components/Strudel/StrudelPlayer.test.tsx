import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StrudelPlayer } from "./StrudelPlayer";
import { loadStrudelRuntime, sanitizeStrudelCode } from "./strudel";

vi.mock("./strudel", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./strudel")>();

	return {
		...actual,
		loadStrudelRuntime: vi.fn(),
	};
});

describe("StrudelPlayer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders on the server without evaluating Strudel browser packages", () => {
		expect(() => renderToString(<StrudelPlayer code={'s("bd sd")'} />)).not.toThrow();
		expect(loadStrudelRuntime).not.toHaveBeenCalled();
	});

	it("loads and evaluates saved read-only patterns when playback is requested", async () => {
		const evaluate = vi.fn().mockResolvedValue(undefined);
		const stop = vi.fn().mockResolvedValue(undefined);
		const clear = vi.fn();
		const setCode = vi.fn();
		const setTheme = vi.fn();
		const StrudelMirror = vi.fn(function StrudelMirror(options: { initialCode?: string }) {
			return {
				code: options.initialCode ?? "",
				evaluate,
				stop,
				setCode,
				clear,
				setTheme,
			};
		});

		vi.mocked(loadStrudelRuntime).mockResolvedValue({
			StrudelMirror,
			getAudioContext: () => ({ currentTime: 0 }),
			webaudioOutput: {},
			transpiler: {},
			prebake: async () => undefined,
		});

		render(<StrudelPlayer code={'s("bd sd")'} readOnly />);

		expect(loadStrudelRuntime).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: "play" }));

		await waitFor(() => {
			expect(evaluate).toHaveBeenCalledOnce();
		});
		expect(loadStrudelRuntime).toHaveBeenCalledOnce();
		expect(StrudelMirror).toHaveBeenCalledWith(
			expect.objectContaining({
				initialCode: sanitizeStrudelCode('s("bd sd")'),
			}),
		);
	});
});
