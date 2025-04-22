import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchApi } from "~/lib/api/fetch-wrapper";
import type { ArticleReportItem } from "~/types/article";

interface ArticlesResponse {
  status: "success" | "error";
  message?: string;
  articles?: ArticleReportItem[];
}

interface ArticleResponse {
  status: "success" | "error";
  message?: string;
  article?: ArticleReportItem;
}

interface AnalyseArticleParams {
  article: string;
  itemId: string;
}

interface AnalyseArticleResponse {
  status: "success" | "error";
  message?: string;
  appDataId?: string;
  itemId?: string;
  analysis?: { content: string; data: any };
}

interface SummariseArticleParams {
  article: string;
  itemId: string;
}

interface SummariseArticleResponse {
  status: "success" | "error";
  message?: string;
  appDataId?: string;
  itemId?: string;
  summary?: { content: string; data: any };
}

interface GenerateReportParams {
  itemId: string;
}

interface GenerateReportResponse {
  status: "success" | "error";
  message?: string;
  appDataId?: string;
  itemId?: string;
}

interface FetchMultipleArticlesResponse {
  status: "success" | "error";
  message?: string;
  articles?: ArticleReportItem[];
}

const fetchArticles = async (): Promise<ArticlesResponse> => {
  const response = await fetchApi("/apps/articles", { method: "GET" });
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(
      errorData?.message || `Failed to fetch articles: ${response.statusText}`,
    );
  }
  return response.json() as Promise<ArticlesResponse>;
};

const fetchArticle = async (id: string): Promise<ArticleResponse> => {
  const response = await fetchApi(`/apps/articles/${id}`, { method: "GET" });
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(
      errorData?.message ||
        `Failed to fetch article report: ${response.statusText}`,
    );
  }
  return response.json() as Promise<ArticleResponse>;
};

const analyseArticle = async (
  params: AnalyseArticleParams,
): Promise<AnalyseArticleResponse> => {
  const response = await fetchApi("/apps/articles/analyse", {
    method: "POST",
    body: params,
  });
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(
      errorData?.message || `Failed to analyse article: ${response.statusText}`,
    );
  }
  return response.json() as Promise<AnalyseArticleResponse>;
};

const summariseArticle = async (
  params: SummariseArticleParams,
): Promise<SummariseArticleResponse> => {
  const response = await fetchApi("/apps/articles/summarise", {
    method: "POST",
    body: params,
  });
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(
      errorData?.message ||
        `Failed to summarise article: ${response.statusText}`,
    );
  }
  return response.json() as Promise<SummariseArticleResponse>;
};

const generateReport = async (
  params: GenerateReportParams,
): Promise<GenerateReportResponse> => {
  const response = await fetchApi("/apps/articles/generate-report", {
    method: "POST",
    body: params,
  });
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(
      errorData?.message || `Failed to generate report: ${response.statusText}`,
    );
  }
  return response.json() as Promise<GenerateReportResponse>;
};

const fetchSourceArticlesByIds = async (
  ids: string[],
): Promise<FetchMultipleArticlesResponse> => {
  if (!ids.length) return { status: "success", articles: [] };

  const queryString = ids
    .map((id) => `ids[]=${encodeURIComponent(id)}`)
    .join("&");
  const response = await fetchApi(`/apps/articles/sources?${queryString}`, {
    method: "GET",
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(
      errorData?.message ||
        `Failed to fetch source articles: ${response.statusText}`,
    );
  }
  return response.json() as Promise<FetchMultipleArticlesResponse>;
};

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
