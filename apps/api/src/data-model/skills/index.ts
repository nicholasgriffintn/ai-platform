import articleAnalysis from "./article-analysis/SKILL.md";
import artifactDesign from "./artifacts/references/design.md";
import artifactTypes from "./artifacts/references/types.md";
import artifacts from "./artifacts/SKILL.md";
import council from "./council/SKILL.md";
import hackerNews from "./hacker-news/SKILL.md";
import promptCraft from "./prompt-craft/SKILL.md";
import recipes from "./recipes/SKILL.md";
import structuredReasoning from "./structured-reasoning/SKILL.md";
import taskDecomposition from "./task-decomposition/SKILL.md";
import tutoring from "./tutoring/SKILL.md";

export const builtInSkillDocuments = [
  {
    directory: "article-analysis",
    rawContent: articleAnalysis,
    resources: [],
  },
  {
    directory: "artifacts",
    rawContent: artifacts,
    resources: [
      { path: "references/design.md", content: artifactDesign },
      { path: "references/types.md", content: artifactTypes },
    ],
  },
  {
    directory: "council",
    rawContent: council,
    resources: [],
  },
  {
    directory: "hacker-news",
    rawContent: hackerNews,
    resources: [],
  },
  {
    directory: "prompt-craft",
    rawContent: promptCraft,
    resources: [],
  },
  {
    directory: "recipes",
    rawContent: recipes,
    resources: [],
  },
  {
    directory: "structured-reasoning",
    rawContent: structuredReasoning,
    resources: [],
  },
  {
    directory: "task-decomposition",
    rawContent: taskDecomposition,
    resources: [],
  },
  {
    directory: "tutoring",
    rawContent: tutoring,
    resources: [],
  },
] as const;
