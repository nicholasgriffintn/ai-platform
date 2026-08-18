import { ArticleAnalysisForm } from "@ngriffin_uk/polychat-component-experiences/content";
import { useNavigate } from "react-router";

import { useArticleAnalysisSession } from "./useArticleAnalysisSession";

interface ArticleAnalysisSessionProps {
  basePath: string;
  projectId?: string;
}

export function ArticleAnalysisSession({ basePath, projectId }: ArticleAnalysisSessionProps) {
  const navigate = useNavigate();
  const session = useArticleAnalysisSession(projectId);

  return (
    <ArticleAnalysisForm
      session={session}
      onReportGenerated={(reportId) => navigate(`${basePath}/${reportId}`)}
    />
  );
}
