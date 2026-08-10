import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StrudelCreateStudio } from "./StrudelCreateStudio";

const mocks = vi.hoisted(() => ({
	generate: vi.fn(),
	save: vi.fn(),
}));

vi.mock("~/components/Strudel/StrudelPlayer", () => ({
	StrudelPlayer: ({ code }: { code: string }) => <div data-testid="strudel-player">{code}</div>,
}));
vi.mock("~/hooks/useModels", () => ({ useModels: () => ({ data: {} }) }));
vi.mock("~/hooks/useStrudel", () => ({
	useGenerateStrudelPattern: () => ({
		isPending: false,
		mutateAsync: mocks.generate,
	}),
	useSaveStrudelPattern: () => ({
		isPending: false,
		mutateAsync: mocks.save,
	}),
}));

describe("StrudelCreateStudio", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.generate.mockResolvedValue({ code: 's("bd")' });
	});

	it("preserves the original generation, metadata, player and example controls", async () => {
		render(
			<MemoryRouter>
				<StrudelCreateStudio basePath="/work/project/strudel" projectId="project-1" />
			</MemoryRouter>,
		);

		expect(screen.getByLabelText("Describe your music")).toBeInTheDocument();
		expect(screen.getByLabelText("Model")).toBeInTheDocument();
		expect(screen.getByLabelText("Style")).toBeInTheDocument();
		expect(screen.getByLabelText("Complexity")).toBeInTheDocument();
		expect(screen.getByLabelText("Tempo (BPM)")).toBeInTheDocument();
		expect(screen.getByLabelText("Name")).toBeInTheDocument();
		expect(screen.getByLabelText(/Tags/)).toBeInTheDocument();
		expect(screen.getByText("Simple Drums")).toBeInTheDocument();
		expect(screen.getByTestId("strudel-player")).toBeInTheDocument();

		fireEvent.change(screen.getByLabelText("Describe your music"), {
			target: { value: "fast techno" },
		});
		fireEvent.change(screen.getByLabelText("Style"), { target: { value: "techno" } });
		fireEvent.change(screen.getByLabelText("Complexity"), { target: { value: "complex" } });
		fireEvent.change(screen.getByLabelText("Tempo (BPM)"), { target: { value: "132" } });
		fireEvent.click(screen.getByRole("button", { name: "Generate pattern" }));

		await waitFor(() => {
			expect(mocks.generate).toHaveBeenCalledWith({
				prompt: "fast techno",
				style: "techno",
				complexity: "complex",
				tempo: 132,
				model: undefined,
			});
		});
	});
});
