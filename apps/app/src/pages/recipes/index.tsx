import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Bot, CalendarClock, Check, MessageCircle, PlugZap, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { AssistantRecipe, RecipeKind } from "@assistant/schemas";

import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/Card";
import { useAssistantRecipes, useInstallAssistantRecipe } from "~/hooks/useRecipes";
import { cn } from "~/lib/utils";

const kindLabels: Record<RecipeKind | "all", string> = {
	all: "All",
	automate: "Automate",
	integrate: "Integrate",
};

function RecipeCard({
	recipe,
	onStart,
	isStarting,
}: {
	recipe: AssistantRecipe;
	onStart: (recipe: AssistantRecipe) => void;
	isStarting: boolean;
}) {
	return (
		<Card className="overflow-hidden border-zinc-200 bg-white/90 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-950/80">
			<CardHeader className="gap-4">
				<div className="flex items-start justify-between gap-3">
					<div className="rounded-2xl bg-blue-500/10 p-3 text-blue-600 dark:text-blue-300">
						{recipe.kind === "automate" ? <Sparkles size={22} /> : <PlugZap size={22} />}
					</div>
					<div className="flex gap-2">
						<span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
							{kindLabels[recipe.kind]}
						</span>
						{recipe.featured && (
							<span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
								Featured
							</span>
						)}
					</div>
				</div>
				<div>
					<CardTitle className="text-xl">{recipe.title}</CardTitle>
					<CardDescription className="mt-2 leading-6">{recipe.summary}</CardDescription>
				</div>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-5">
				<p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">{recipe.description}</p>
				<div className="flex flex-wrap gap-2">
					{recipe.integrations.map((integration) => (
						<span
							key={integration.id}
							className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
						>
							{integration.name}
						</span>
					))}
				</div>
				<div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
					<div className="flex items-center gap-2">
						<CalendarClock size={16} className="text-blue-500" />
						<span>{recipe.estimatedSetupMinutes} min guided setup</span>
					</div>
					<div className="flex items-center gap-2">
						<MessageCircle size={16} className="text-blue-500" />
						<span>Starts as an assistant conversation</span>
					</div>
				</div>
				<div className="mt-auto space-y-2">
					{recipe.actions.slice(0, 2).map((action) => (
						<div
							key={action}
							className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-300"
						>
							<Check size={15} className="mt-0.5 shrink-0 text-emerald-500" />
							<span>{action}</span>
						</div>
					))}
				</div>
				<Button variant="primary" fullWidth onClick={() => onStart(recipe)} isLoading={isStarting}>
					Set up in chat
				</Button>
			</CardContent>
		</Card>
	);
}

export function meta() {
	return [
		{ title: "Recipes - Polychat" },
		{
			name: "description",
			content: "One-tap assistant recipes for automations and integrations.",
		},
	];
}

export default function RecipesPage() {
	const navigate = useNavigate();
	const [kind, setKind] = useState<RecipeKind | "all">("all");
	const [category, setCategory] = useState("All");
	const [search, setSearch] = useState("");
	const { data, isLoading, error } = useAssistantRecipes();
	const installRecipe = useInstallAssistantRecipe();

	const recipes = data?.recipes ?? [];
	const categories = ["All", ...(data?.categories ?? [])];
	const filteredRecipes = useMemo(
		() =>
			recipes.filter((recipe) => {
				const matchesKind = kind === "all" || recipe.kind === kind;
				const matchesCategory = category === "All" || recipe.category === category;
				const query = search.trim().toLowerCase();
				const matchesSearch =
					!query ||
					[recipe.title, recipe.summary, recipe.description, recipe.category, ...recipe.actions]
						.join(" ")
						.toLowerCase()
						.includes(query);

				return matchesKind && matchesCategory && matchesSearch;
			}),
		[category, kind, recipes, search],
	);

	const handleStart = async (recipe: AssistantRecipe) => {
		try {
			const setup = await installRecipe.mutateAsync(recipe.id);
			navigate(setup.messageUrl);
		} catch (startError) {
			console.error(startError);
			toast.error("Could not start recipe setup. Please try again.");
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-white text-zinc-950 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900 dark:text-zinc-50">
			<header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
				<Link to="/" className="flex items-center gap-2 font-semibold">
					<Bot className="text-blue-600" />
					Polychat
				</Link>
				<Button variant="outline" onClick={() => navigate("/")}>
					Open chat
				</Button>
			</header>

			<main className="mx-auto max-w-7xl px-6 pb-16 pt-8">
				<section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
					<div>
						<p className="mb-4 inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-200">
							Assistant Recipes
						</p>
						<h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
							Set up automations with one assistant conversation.
						</h1>
						<p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
							Pick a recipe, then Polychat opens a guided chat to connect tools, choose triggers,
							confirm privacy boundaries, and test the setup before anything runs automatically.
						</p>
					</div>
					<div className="rounded-3xl border border-blue-100 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
						<div className="space-y-4">
							{[
								"Choose a recipe",
								"Connect integrations",
								"Message your assistant",
								"Approve automations",
							].map((step, index) => (
								<div
									key={step}
									className="flex items-center gap-3 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900"
								>
									<span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
										{index + 1}
									</span>
									<span className="font-medium">{step}</span>
								</div>
							))}
						</div>
					</div>
				</section>

				<section className="mt-12 space-y-5">
					<div className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80 lg:flex-row lg:items-center">
						<div className="relative flex-1">
							<Search
								className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
								size={18}
							/>
							<input
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								placeholder="Search email, health, developer, travel..."
								className="w-full rounded-2xl border border-zinc-200 bg-white py-3 pl-10 pr-4 outline-none transition focus:border-blue-400 dark:border-zinc-800 dark:bg-zinc-900"
							/>
						</div>
						<div className="flex flex-wrap gap-2">
							{(["all", "automate", "integrate"] as const).map((nextKind) => (
								<button
									key={nextKind}
									onClick={() => setKind(nextKind)}
									className={cn(
										"rounded-full px-4 py-2 text-sm font-medium transition",
										kind === nextKind
											? "bg-blue-600 text-white"
											: "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
									)}
								>
									{kindLabels[nextKind]}
								</button>
							))}
						</div>
					</div>

					<div className="flex flex-wrap gap-2">
						{categories.map((nextCategory) => (
							<button
								key={nextCategory}
								onClick={() => setCategory(nextCategory)}
								className={cn(
									"rounded-full border px-3 py-1.5 text-sm transition",
									category === nextCategory
										? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200"
										: "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-300",
								)}
							>
								{nextCategory}
							</button>
						))}
					</div>
				</section>

				{error ? (
					<div className="mt-12 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
						Failed to load recipes. Please refresh and try again.
					</div>
				) : isLoading ? (
					<div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
						{Array.from({ length: 6 }).map((_, index) => (
							<div
								key={index}
								className="h-80 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900"
							/>
						))}
					</div>
				) : (
					<div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
						{filteredRecipes.map((recipe) => (
							<RecipeCard
								key={recipe.id}
								recipe={recipe}
								onStart={handleStart}
								isStarting={installRecipe.isPending && installRecipe.variables === recipe.id}
							/>
						))}
					</div>
				)}
			</main>
		</div>
	);
}
