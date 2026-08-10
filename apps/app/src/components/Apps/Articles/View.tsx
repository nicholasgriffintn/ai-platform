import type { ArticleReportItem } from "~/types";
import { ArticleReportContent } from "./ArticleReportContent";
import { ArticleReportHeader } from "./ArticleReportHeader";
import { ArticleReportMetadata } from "./ArticleReportMetadata";
import { ArticleSourceArticles } from "./ArticleSourceArticles";

export function ArticleView({
	report,
	sourceIds,
	isShared,
	basePath,
	projectId,
}: {
	report: ArticleReportItem;
	sourceIds: string[];
	isShared?: boolean;
	basePath?: string;
	projectId?: string;
}) {
	return (
		<div className="space-y-6">
			<ArticleReportHeader
				report={report}
				isShared={isShared}
				basePath={basePath}
				projectId={projectId}
			/>
			<ArticleReportContent report={report} />
			<ArticleSourceArticles sourceIds={sourceIds} projectId={projectId} />
			<ArticleReportMetadata report={report} />
		</div>
	);
}
