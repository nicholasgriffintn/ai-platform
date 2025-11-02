import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
	analyseArticle,
	extractArticleContent,
	fetchArticle,
	fetchArticles,
	fetchSourceArticlesByIds,
	generateReport,
	prepareSessionForRerun,
	summariseArticle,
} from "~/lib/api/dynamic-apps";

export const useFetchArticleReports = () => {
	return useQuery({
		queryKey: ["articles", "reports"],
		queryFn: fetchArticles,
		select: (data) => data.articles || [],
	});
};

export const useFetchArticleReport = (id: string | undefined) => {
	return useQuery({
		queryKey: ["articleReport", id],
		queryFn: () => fetchArticle(id!),
		enabled: !!id,
		select: (data) => data.article,
	});
};

export const useAnalyseArticle = () => {
	return useMutation({ mutationFn: analyseArticle });
};

export const useSummariseArticle = () => {
	return useMutation({ mutationFn: summariseArticle });
};

export const useGenerateReport = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: generateReport,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["articles", "reports"] });
		},
	});
};

export const useFetchSourceArticlesByIds = (ids: string[] | undefined) => {
	return useQuery({
		queryKey: ["articles", "multiple", ids],
		queryFn: () => fetchSourceArticlesByIds(ids || []),
		enabled: !!ids && ids.length > 0,
		select: (data) => data.articles || [],
	});
};

export const useExtractArticleContent = () => {
	return useMutation({ mutationFn: extractArticleContent });
};

export const usePrepareSessionForRerun = () => {
	return useMutation({
		mutationFn: prepareSessionForRerun,
	});
};
