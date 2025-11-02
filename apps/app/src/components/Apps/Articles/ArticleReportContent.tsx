import { FileText } from "lucide-react";

import { Markdown } from "~/components/ui/Markdown";
import type { ArticleReportItem } from "~/types/article";

interface ArticleReportContentProps {
	report: ArticleReportItem;
}

export function ArticleReportContent({ report }: ArticleReportContentProps) {
	return (
		<div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-5 shadow-sm">
			<h3 className="text-lg font-medium mb-4 flex items-center text-zinc-900 dark:text-zinc-100">
				<FileText size={18} className="mr-2 text-blue-500 dark:text-blue-400" />
				Report Content
			</h3>
			{report.data?.report?.content ? (
				<div className="prose dark:prose-invert max-w-none p-5 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-900/50">
					<Markdown>{report.data.report.content}</Markdown>
				</div>
			) : (
				<p className="text-zinc-500 dark:text-zinc-400 italic p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg">
					No report content available.
				</p>
			)}
		</div>
	);
}
