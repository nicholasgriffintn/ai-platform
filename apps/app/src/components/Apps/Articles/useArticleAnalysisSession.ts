import { useCallback, useMemo, useState } from "react";

import {
	useAnalyseArticle,
	useExtractArticleContent,
	useGenerateReport,
	useSummariseArticle,
} from "~/hooks/useArticles";
import { getErrorMessage } from "~/lib/errors";
import type { ArticleInput } from "~/types/article";

export function useArticleAnalysisSession(projectId?: string) {
	const [itemId] = useState(() => crypto.randomUUID());
	const [articles, setArticles] = useState<ArticleInput[]>([{ id: crypto.randomUUID(), text: "" }]);
	const [urlInputs, setUrlInputs] = useState<Record<string, string>>({});
	const [extractingContent, setExtractingContent] = useState<Record<string, boolean>>({});
	const [processingArticles, setProcessingArticles] = useState(false);
	const [reportGenerating, setReportGenerating] = useState(false);
	const [processingError, setProcessingError] = useState<string | null>(null);
	const analyse = useAnalyseArticle(projectId);
	const summarise = useSummariseArticle(projectId);
	const generateReport = useGenerateReport(projectId);
	const extractContent = useExtractArticleContent(projectId);

	const addArticle = useCallback(() => {
		setArticles((current) => [...current, { id: crypto.randomUUID(), text: "" }]);
	}, []);

	const removeArticle = useCallback((articleId: string) => {
		setArticles((current) => current.filter((article) => article.id !== articleId));
	}, []);

	const setArticleText = useCallback((articleId: string, text: string) => {
		setArticles((current) =>
			current.map((article) => (article.id === articleId ? { ...article, text } : article)),
		);
	}, []);

	const setArticleUrl = useCallback((articleId: string, url: string) => {
		setUrlInputs((current) => ({ ...current, [articleId]: url }));
	}, []);

	const fetchArticleContent = useCallback(
		async (articleId: string) => {
			const url = urlInputs[articleId]?.trim();
			if (!url) return;

			setExtractingContent((current) => ({ ...current, [articleId]: true }));
			setProcessingError(null);
			try {
				const result = await extractContent.mutateAsync({
					urls: [url],
					extractDepth: "basic",
				});
				const content = result.data?.content[0];
				if (content) {
					setArticleText(articleId, content);
					return;
				}
				const extractionError = result.data?.failedUrls[0]?.error;
				setProcessingError(
					extractionError
						? `Failed to extract content: ${extractionError}`
						: "No article content was found.",
				);
			} catch (error) {
				setProcessingError(`Error extracting content: ${getErrorMessage(error, "Unknown error")}`);
			} finally {
				setExtractingContent((current) => ({ ...current, [articleId]: false }));
			}
		},
		[extractContent, setArticleText, urlInputs],
	);

	const processAndGenerate = useCallback(async () => {
		const validArticles = articles.filter((article) => article.text.trim());
		if (!validArticles.length) {
			setProcessingError("Please add content to at least one article.");
			return undefined;
		}

		setProcessingArticles(true);
		setReportGenerating(false);
		setProcessingError(null);
		try {
			await Promise.all([
				...validArticles.map((article) => analyse.mutateAsync({ article: article.text, itemId })),
				...validArticles.map((article) => summarise.mutateAsync({ article: article.text, itemId })),
			]);
			setProcessingArticles(false);
			setReportGenerating(true);
			const result = await generateReport.mutateAsync({ itemId });
			if (!result.outputId) {
				throw new Error("Report generated but no saved report was returned.");
			}
			return result.outputId;
		} catch (error) {
			setProcessingError(getErrorMessage(error, "Article processing failed."));
			return undefined;
		} finally {
			setProcessingArticles(false);
			setReportGenerating(false);
		}
	}, [analyse, articles, generateReport, itemId, summarise]);

	const isGenerateEnabled = useMemo(
		() =>
			!processingArticles && !reportGenerating && articles.some((article) => article.text.trim()),
		[articles, processingArticles, reportGenerating],
	);

	return {
		itemId,
		articles,
		urlInputs,
		extractingContent,
		processingArticles,
		reportGenerating,
		processingError,
		isGenerateEnabled,
		actions: {
			addArticle,
			removeArticle,
			setArticleText,
			setArticleUrl,
			fetchArticleContent,
			processAndGenerate,
		},
	};
}
