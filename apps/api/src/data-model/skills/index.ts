import artifacts from "./artifacts/SKILL.md";
import artifactDesign from "./artifacts/references/design.md";
import artifactTypes from "./artifacts/references/types.md";
import recipes from "./recipes/SKILL.md";

export const builtInSkillDocuments = [
	{
		directory: "artifacts",
		rawContent: artifacts,
		resources: [
			{ path: "references/design.md", content: artifactDesign },
			{ path: "references/types.md", content: artifactTypes },
		],
	},
	{
		directory: "recipes",
		rawContent: recipes,
		resources: [],
	},
] as const;
