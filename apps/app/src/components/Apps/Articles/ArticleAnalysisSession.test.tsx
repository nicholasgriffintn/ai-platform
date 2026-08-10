import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { ArticleAnalysisSession } from "./ArticleAnalysisSession";

vi.mock("./useArticleAnalysisSession", () => ({
	useArticleAnalysisSession: () => ({
		itemId: "session-1",
		articles: [{ id: "article-1", text: "" }],
		urlInputs: {},
		extractingContent: {},
		processingArticles: false,
		reportGenerating: false,
		processingError: null,
		isGenerateEnabled: false,
		actions: {
			addArticle: vi.fn(),
			removeArticle: vi.fn(),
			setArticleText: vi.fn(),
			setArticleUrl: vi.fn(),
			fetchArticleContent: vi.fn(),
			processAndGenerate: vi.fn(),
		},
	}),
}));

describe("ArticleAnalysisSession", () => {
	it("preserves the original per-source extraction and manual content workflow", () => {
		render(
			<MemoryRouter>
				<ArticleAnalysisSession basePath="/work/project/articles" projectId="project-1" />
			</MemoryRouter>,
		);

		expect(screen.getByText("New Article Analysis Session")).toBeInTheDocument();
		expect(screen.getByText("Session ID: session-1")).toBeInTheDocument();
		expect(screen.getByPlaceholderText("Enter article URL...")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Fetch Content" })).toBeInTheDocument();
		expect(screen.getByPlaceholderText("Paste article content here...")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Add Another Article" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Process & Generate Report" })).toBeDisabled();
	});
});
