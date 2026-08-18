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
} from "~/lib/api/apps";

export const useFetchArticleReports = (projectId?: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["articles", projectId, "reports"],
    queryFn: () => fetchArticles(projectId),
    enabled: options?.enabled ?? true,
    select: (data) => data.articles || [],
  });
};

export const useFetchArticleReport = (id: string | undefined, projectId?: string) => {
  return useQuery({
    queryKey: ["articleReport", projectId, id],
    queryFn: () => fetchArticle(id!, projectId),
    enabled: !!id,
    select: (data) => data.article,
  });
};

export const useAnalyseArticle = (projectId?: string) => {
  return useMutation({
    mutationFn: (params: Parameters<typeof analyseArticle>[0]) => analyseArticle(params, projectId),
  });
};

export const useSummariseArticle = (projectId?: string) => {
  return useMutation({
    mutationFn: (params: Parameters<typeof summariseArticle>[0]) =>
      summariseArticle(params, projectId),
  });
};

export const useGenerateReport = (projectId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: Parameters<typeof generateReport>[0]) => generateReport(params, projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["articles", projectId, "reports"] });
    },
  });
};

export const useFetchSourceArticlesByIds = (ids: string[] | undefined, projectId?: string) => {
  return useQuery({
    queryKey: ["articles", projectId, "multiple", ids],
    queryFn: () => fetchSourceArticlesByIds(ids || [], projectId),
    enabled: !!ids && ids.length > 0,
    select: (data) => data.articles || [],
  });
};

export const useExtractArticleContent = (projectId?: string) => {
  return useMutation({
    mutationFn: (params: Parameters<typeof extractArticleContent>[0]) =>
      extractArticleContent(params, projectId),
  });
};

export const usePrepareSessionForRerun = (projectId?: string) => {
  return useMutation({
    mutationFn: (itemId: string) => prepareSessionForRerun(itemId, projectId),
  });
};
