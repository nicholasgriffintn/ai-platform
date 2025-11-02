import type { ArticleReportItem } from "~/types/article";
import { RerunReportButton } from "./RerunReportButton";

interface ArticleReportHeaderProps {
	report: ArticleReportItem;
	isShared?: boolean;
}

export function ArticleReportHeader({
	report,
	isShared,
}: ArticleReportHeaderProps) {
	return (
		<div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-5 shadow-sm">
			<div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
				<h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
					{report.data?.title || `Report (ID: ${report.id})`}
				</h2>
				{!isShared && (
					<RerunReportButton
						sourceIds={report.data?.sourceItemIds || []}
						itemId={report.item_id || ""}
					/>
				)}
			</div>
		</div>
	);
}
