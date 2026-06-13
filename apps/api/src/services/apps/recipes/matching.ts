import type { AssistantRecipe, RecipeInstallation } from "@assistant/schemas";

const GENERIC_TRIGGER_WORDS = new Set([
	"automation",
	"automations",
	"installed",
	"my",
	"recipe",
	"recipes",
	"run",
	"start",
	"trigger",
]);

const STOP_WORDS = new Set(["a", "an", "and", "for", "in", "me", "of", "on", "the", "to", "with"]);

export interface InstalledRecipeMatchCandidate {
	recipeId: string;
	title: string;
	score: number;
}

export interface InstalledRecipeMatchResult {
	status: "matched" | "ambiguous" | "not_found";
	recipe?: AssistantRecipe;
	installation?: RecipeInstallation;
	candidates: InstalledRecipeMatchCandidate[];
}

export interface InstalledRecipeMatchInput {
	query: string;
	recipes: AssistantRecipe[];
	installations: RecipeInstallation[];
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function tokenise(value: string): string[] {
	const tokens = value
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.map((token) => token.trim())
		.filter((token) => token.length > 1 && !STOP_WORDS.has(token));

	return Array.from(new Set(tokens));
}

function buildRecipeSearchText(recipe: AssistantRecipe): string {
	return [
		recipe.id,
		recipe.title,
		recipe.summary,
		recipe.description,
		recipe.category,
		recipe.kind,
		...recipe.actions,
		...recipe.integrations.flatMap((integration) => [
			integration.providerId,
			integration.name,
			integration.description,
		]),
	]
		.filter(Boolean)
		.join(" ");
}

function scoreRecipe(query: string, queryTokens: string[], recipe: AssistantRecipe): number {
	const querySlug = slugify(query);
	const titleSlug = slugify(recipe.title);
	const recipeSlug = slugify(recipe.id);
	let score = 0;

	if (querySlug === recipeSlug || querySlug === titleSlug) {
		score += 100;
	} else {
		if (querySlug.includes(recipeSlug) || recipeSlug.includes(querySlug)) {
			score += 60;
		}
		if (querySlug.includes(titleSlug) || titleSlug.includes(querySlug)) {
			score += 60;
		}
	}

	const searchableText = buildRecipeSearchText(recipe).toLowerCase();
	for (const token of queryTokens) {
		if (recipe.id.includes(token)) {
			score += 8;
		}
		if (recipe.title.toLowerCase().includes(token)) {
			score += 6;
		}
		if (searchableText.includes(token)) {
			score += 2;
		}
	}

	return score;
}

function isGenericTrigger(queryTokens: string[]) {
	return queryTokens.length > 0 && queryTokens.every((token) => GENERIC_TRIGGER_WORDS.has(token));
}

export function matchInstalledRecipe({
	query,
	recipes,
	installations,
}: InstalledRecipeMatchInput): InstalledRecipeMatchResult {
	const activeInstallations = installations.filter(
		(installation) => installation.status === "active",
	);
	if (activeInstallations.length === 0) {
		return { status: "not_found", candidates: [] };
	}

	const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
	const installedRecipes = activeInstallations
		.map((installation) => {
			const recipe = recipeById.get(installation.recipeId);
			return recipe ? { recipe, installation } : null;
		})
		.filter((item): item is { recipe: AssistantRecipe; installation: RecipeInstallation } =>
			Boolean(item),
		);

	const trimmedQuery = query.trim();
	const queryTokens = tokenise(trimmedQuery);
	if (!trimmedQuery || queryTokens.length === 0 || isGenericTrigger(queryTokens)) {
		if (installedRecipes.length === 1) {
			const [{ recipe, installation }] = installedRecipes;
			return {
				status: "matched",
				recipe,
				installation,
				candidates: [{ recipeId: recipe.id, title: recipe.title, score: 1 }],
			};
		}

		return {
			status: "ambiguous",
			candidates: installedRecipes.map(({ recipe }) => ({
				recipeId: recipe.id,
				title: recipe.title,
				score: 1,
			})),
		};
	}

	const candidates = installedRecipes
		.map(({ recipe }) => ({
			recipeId: recipe.id,
			title: recipe.title,
			score: scoreRecipe(trimmedQuery, queryTokens, recipe),
		}))
		.filter((candidate) => candidate.score > 0)
		.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

	const [best, second] = candidates;
	if (!best || best.score < 8) {
		return { status: "not_found", candidates };
	}
	if (second && second.score >= best.score - 4) {
		return { status: "ambiguous", candidates: candidates.slice(0, 5) };
	}

	const recipe = recipeById.get(best.recipeId);
	const installation = activeInstallations.find((item) => item.recipeId === best.recipeId);
	if (!recipe || !installation) {
		return { status: "not_found", candidates };
	}

	return {
		status: "matched",
		recipe,
		installation,
		candidates: candidates.slice(0, 5),
	};
}
