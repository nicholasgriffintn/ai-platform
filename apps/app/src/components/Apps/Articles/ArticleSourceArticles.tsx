import {
	ArrowDown,
	ChevronDown,
	ExternalLink,
	FileText,
	Info,
	Loader2,
} from "lucide-react";
import { useState } from "react";

import { Markdown } from "~/components/ui/Markdown";
import { useFetchSourceArticlesByIds } from "~/hooks/useArticles";
import { cn } from "~/lib/utils";

interface SourceArticleData {
	originalArticle?: string;
	analysis?: {
		content?: string;
		model?: string;
		citations?: string[];
		verifiedQuotes?: {
			verified: boolean;
			missingQuotes: string[];
		};
	};
	title?: string;
	text?: string;
}

interface ArticleSourceArticlesProps {
	sourceIds: string[];
}

export function ArticleSourceArticles({
	sourceIds,
}: ArticleSourceArticlesProps) {
	const { data: sourceArticles, isLoading: isLoadingSourceArticles } =
		useFetchSourceArticlesByIds(sourceIds);

	const [isSourcesExpanded, setIsSourcesExpanded] = useState(true);
	const [expandedArticleIds, setExpandedArticleIds] = useState<
		Record<string, boolean>
	>({});
	const [expandedOriginalArticles, setExpandedOriginalArticles] = useState<
		Record<string, boolean>
	>({});

	const toggleArticleExpanded = (articleId: string) => {
		setExpandedArticleIds((prev) => ({
			...prev,
			[articleId]: !prev[articleId],
		}));
	};

	const toggleOriginalArticleExpanded = (articleId: string) => {
		setExpandedOriginalArticles((prev) => ({
			...prev,
			[articleId]: !prev[articleId],
		}));
	};

	return (
		<div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden">
			<button
				type="button"
				onClick={() => setIsSourcesExpanded(!isSourcesExpanded)}
				className="w-full flex items-center justify-between p-5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
			>
				<h3 className="text-lg font-medium flex items-center text-zinc-900 dark:text-zinc-100">
					<FileText
						size={18}
						className="mr-2 text-blue-500 dark:text-blue-400"
					/>
					Source Articles ({sourceIds.length})
				</h3>
				<div className="flex items-center">
					<span className="text-sm text-zinc-500 dark:text-zinc-400 mr-2">
						{isSourcesExpanded ? "Hide" : "Show"} details
					</span>
					<ArrowDown
						size={18}
						className={cn(
							"text-zinc-500 dark:text-zinc-400 transition-transform duration-300",
							isSourcesExpanded ? "rotate-180" : "",
						)}
					/>
				</div>
			</button>

			{isSourcesExpanded && (
				<div className="p-5 border-t border-zinc-200 dark:border-zinc-700 transition-all duration-300 animate-in slide-in-from-top-10">
					{isLoadingSourceArticles ? (
						<div className="flex justify-center items-center py-12">
							<div className="flex flex-col items-center">
								<Loader2
									size={32}
									className="animate-spin text-blue-500 mb-3"
								/>
								<p className="text-zinc-500 dark:text-zinc-400">
									Loading source articles...
								</p>
							</div>
						</div>
					) : sourceArticles && sourceArticles.length > 0 ? (
						<div className="space-y-4">
							{sourceArticles.map((article, index) => {
								const articleData = article.data as SourceArticleData;
								const isExpanded = !!expandedArticleIds[article.id];
								const articleTitle =
									articleData?.title?.replace("Analysis: ", "") ||
									`Source Article ${index + 1}`;

								return (
									<div
										key={article.id}
										className={cn(
											"border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden transition-all duration-300",
											isExpanded ? "shadow-md" : "shadow-sm",
										)}
									>
										<button
											type="button"
											onClick={() => toggleArticleExpanded(article.id)}
											className="w-full p-4 flex items-center justify-between text-left bg-zinc-50 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition-colors"
										>
											<div className="flex items-center min-w-0">
												<div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-md mr-3 flex-shrink-0">
													<FileText
														size={18}
														className="text-blue-500 dark:text-blue-400"
													/>
												</div>
												<div className="flex-grow min-w-0">
													<h4 className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
														{articleTitle}
													</h4>
													<p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
														{new Date(article.created_at).toLocaleString()}
													</p>
												</div>
											</div>
											<div className="flex items-center ml-2 flex-shrink-0">
												<span className="text-sm text-zinc-500 dark:text-zinc-400 mr-2 hidden sm:inline">
													{isExpanded ? "Hide" : "View"} details
												</span>
												<ChevronDown
													size={18}
													className={cn(
														"text-zinc-400 dark:text-zinc-500 transition-transform duration-300",
														isExpanded ? "rotate-180" : "",
													)}
												/>
											</div>
										</button>

										{isExpanded && (
											<div className="animate-in slide-in-from-top-5 duration-300">
												{articleData?.originalArticle && (
													<div className="p-4 bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
														<button
															type="button"
															onClick={(e) => {
																e.stopPropagation();
																toggleOriginalArticleExpanded(article.id);
															}}
															className="w-full flex justify-between items-center text-left mb-3 group"
														>
															<h5 className="font-medium text-sm flex items-center text-zinc-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
																<FileText
																	size={14}
																	className="mr-2 text-blue-500 dark:text-blue-400"
																/>
																Original Article
															</h5>
															<ChevronDown
																size={16}
																className={cn(
																	"text-zinc-400 transition-transform duration-300",
																	expandedOriginalArticles[article.id]
																		? "rotate-180"
																		: "",
																)}
															/>
														</button>

														{expandedOriginalArticles[article.id] ? (
															<div className="prose prose-sm dark:prose-invert max-w-none animate-in slide-in-from-top-2 duration-200 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-md border border-zinc-200 dark:border-zinc-700">
																<Markdown>
																	{articleData.originalArticle}
																</Markdown>
															</div>
														) : (
															<button
																type="button"
																onClick={(e) => {
																	e.stopPropagation();
																	toggleOriginalArticleExpanded(article.id);
																}}
																className="w-full text-left p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900/80 transition-colors"
															>
																<p className="line-clamp-3 text-sm text-zinc-700 dark:text-zinc-300">
																	{articleData.originalArticle.substring(
																		0,
																		200,
																	)}
																	{articleData.originalArticle.length > 200
																		? "..."
																		: ""}
																</p>
																<div className="text-blue-500 dark:text-blue-400 text-xs mt-2 font-medium flex items-center">
																	<span>Read full article</span>
																	<ChevronDown
																		size={14}
																		className="ml-1 transform -rotate-90"
																	/>
																</div>
															</button>
														)}
													</div>
												)}

												{articleData?.analysis?.content && (
													<div className="p-4 bg-white dark:bg-zinc-800">
														<h5 className="font-medium text-sm flex items-center text-zinc-800 dark:text-zinc-200 mb-3">
															<FileText
																size={14}
																className="mr-2 text-blue-500 dark:text-blue-400"
															/>
															Analysis
															{articleData.analysis.model && (
																<span className="ml-2 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-700 rounded-full text-xs font-normal text-zinc-500 dark:text-zinc-400">
																	Model: {articleData.analysis.model}
																</span>
															)}
														</h5>
														<div className="prose prose-sm dark:prose-invert max-w-none p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-md border border-zinc-200 dark:border-zinc-700">
															<Markdown>
																{articleData.analysis.content}
															</Markdown>
														</div>

														<div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
															{articleData.analysis.citations &&
																articleData.analysis.citations.length > 0 && (
																	<div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-md border border-zinc-200 dark:border-zinc-700">
																		<h6 className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2 flex items-center">
																			<ExternalLink
																				size={12}
																				className="mr-1.5"
																			/>
																			Citations
																		</h6>
																		<ul className="text-xs space-y-1.5 list-none pl-0">
																			{articleData.analysis.citations.map(
																				(citation: string, i: number) => (
																					<li
																						key={`citation-${article.id}-${i}`}
																						className="break-all bg-white dark:bg-zinc-800 p-2 rounded border border-zinc-200 dark:border-zinc-700"
																					>
																						<a
																							href={citation}
																							target="_blank"
																							rel="noopener noreferrer"
																							className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline"
																						>
																							<span className="truncate">
																								{citation}
																							</span>
																							<ExternalLink
																								size={10}
																								className="ml-1 flex-shrink-0"
																							/>
																						</a>
																					</li>
																				),
																			)}
																		</ul>
																	</div>
																)}

															{articleData.analysis.verifiedQuotes && (
																<div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-md border border-zinc-200 dark:border-zinc-700">
																	<h6 className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2 flex items-center">
																		<Info size={12} className="mr-1.5" />
																		Quote Verification
																	</h6>
																	<div className="text-xs space-y-2">
																		<div className="flex items-center">
																			<span
																				className={cn(
																					"px-2 py-1 rounded-full text-xs font-medium",
																					articleData.analysis.verifiedQuotes
																						.verified
																						? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300"
																						: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300",
																				)}
																			>
																				{articleData.analysis.verifiedQuotes
																					.verified
																					? "Verified"
																					: "Not Verified"}
																			</span>
																		</div>

																		{articleData.analysis.verifiedQuotes
																			.missingQuotes?.length > 0 && (
																			<div>
																				<span className="font-medium text-zinc-700 dark:text-zinc-300">
																					Missing Quotes:
																				</span>
																				<ul className="list-disc pl-4 mt-1 space-y-1">
																					{articleData.analysis.verifiedQuotes.missingQuotes.map(
																						(quote: string, i: number) => (
																							<li
																								key={`missing-quote-${article.id}-${i}`}
																								className="mt-1 bg-white dark:bg-zinc-800 p-2 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
																							>
																								"{quote}"
																							</li>
																						),
																					)}
																				</ul>
																			</div>
																		)}
																	</div>
																</div>
															)}
														</div>
													</div>
												)}
											</div>
										)}
									</div>
								);
							})}
						</div>
					) : (
						<div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg p-6 text-center border border-zinc-200 dark:border-zinc-700">
							<FileText
								size={32}
								className="mx-auto mb-3 text-zinc-400 dark:text-zinc-500"
							/>
							<p className="text-zinc-500 dark:text-zinc-400">
								No source articles found.
							</p>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
