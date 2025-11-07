import { Sparkles, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { BackLink } from "~/components/Core/BackLink";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { AppsSidebarContent } from "~/components/Sidebar/AppsSidebarContent";
import { StrudelPlayer } from "~/components/Strudel/StrudelPlayer";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	FormSelect,
	Input,
	Label,
	Textarea,
} from "~/components/ui";
import {
	useGenerateStrudelPattern,
	useSaveStrudelPattern,
} from "~/hooks/useStrudel";
import { useModels } from "~/hooks/useModels";
import {
	defaultCode,
	examplePatterns,
	type PatternExample,
} from "~/lib/strudel/examples";
import { getAvailableModels } from "~/lib/models";
import { cn } from "~/lib/utils";
import type { StrudelComplexity, StrudelStyle } from "~/types";

const parseTagsInput = (value: string): string[] =>
	value
		.split(",")
		.map((tag) => tag.trim())
		.filter(Boolean);

const STYLE_OPTIONS: { label: string; value: "" | StrudelStyle }[] = [
	{ label: "Auto", value: "" },
	{ label: "Techno", value: "techno" },
	{ label: "Ambient", value: "ambient" },
	{ label: "House", value: "house" },
	{ label: "Jazz", value: "jazz" },
	{ label: "Drums", value: "drums" },
	{ label: "Experimental", value: "experimental" },
];

const COMPLEXITY_OPTIONS: { label: string; value: StrudelComplexity }[] = [
	{ label: "Simple", value: "simple" },
	{ label: "Medium", value: "medium" },
	{ label: "Complex", value: "complex" },
];

export function meta() {
	return [
		{ title: "Create Strudel Pattern - Polychat" },
		{
			name: "description",
			content:
				"Generate or live-code Strudel music loops directly in Polychat.",
		},
	];
}

export default function CreateStrudelPatternPage() {
	const navigate = useNavigate();
	const generateMutation = useGenerateStrudelPattern();
	const saveMutation = useSaveStrudelPattern();
	const { data: apiModels = {} } = useModels();

	const [prompt, setPrompt] = useState("");
	const [style, setStyle] = useState<"" | StrudelStyle>("");
	const [complexity, setComplexity] = useState<StrudelComplexity>("medium");
	const [tempo, setTempo] = useState<string>("");
	const [selectedModel, setSelectedModel] = useState<string>("");
	const [code, setCode] = useState(defaultCode);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [tagsInput, setTagsInput] = useState("");
	const [selectedExampleId, setSelectedExampleId] = useState<string | null>(
		null,
	);

	const parsedTags = useMemo(() => parseTagsInput(tagsInput), [tagsInput]);

	const availableModels = getAvailableModels(apiModels, false);
	const textModels = Object.entries(availableModels)
		.filter(([_, model]) => model.type.length === 1 && model.type[0] === "text")
		.map(([id, model]) => ({
			value: id,
			label: model.name || id,
			provider: model.provider,
		}));

	const handleGenerate = async () => {
		if (!prompt.trim()) {
			toast.error("Describe what you want to hear first");
			return;
		}

		try {
			const payload = await generateMutation.mutateAsync({
				prompt: prompt.trim(),
				style: style || undefined,
				complexity,
				tempo: tempo ? Number(tempo) : undefined,
				model: selectedModel || undefined,
			});
			setCode(payload.code);
			if (!name.trim()) {
				setName(prompt.slice(0, 64));
			}
			toast.success("Generated a new Strudel pattern");
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Unable to generate pattern",
			);
		}
	};

	const handleSave = async () => {
		if (!name.trim()) {
			toast.error("Give your pattern a name");
			return;
		}

		try {
			const pattern = await saveMutation.mutateAsync({
				name: name.trim(),
				code,
				description: description.trim() || undefined,
				tags: parsedTags,
			});
			toast.success("Pattern saved");
			navigate(`/apps/strudel/${pattern.id}`);
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to save pattern",
			);
		}
	};

	const handleLoadExample = (example: PatternExample) => {
		setSelectedExampleId(example.id);
		setCode(example.code);
		if (!name.trim()) {
			setName(example.name);
		}
		toast.success(`Loaded ${example.name}`);
	};

	const headerContent = (
		<PageHeader>
			<BackLink to="/apps/strudel" label="Back to Strudel" />
			<PageTitle title="Create a Strudel pattern" />
			<p className="text-sm text-muted-foreground">
				Use AI to sketch a loop or load one of the baked-in examples, then play
				it instantly in the Strudel web player.
			</p>
		</PageHeader>
	);

	return (
		<PageShell
			sidebarContent={<AppsSidebarContent />}
			className="max-w-7xl mx-auto"
			headerContent={headerContent}
		>
			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
				<div className="space-y-6">
					<Card>
						<CardHeader>
							<div className="flex items-center gap-3">
								<div className="rounded-lg bg-blue-600/10 p-2 text-blue-600">
									<Sparkles className="h-5 w-5" />
								</div>
								<div>
									<CardTitle>AI generation</CardTitle>
									<CardDescription>
										Describe the groove you want and we will craft a Strudel
										seed.
									</CardDescription>
								</div>
							</div>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="strudel-prompt">Describe your music</Label>
								<Textarea
									id="strudel-prompt"
									value={prompt}
									onChange={(event) => setPrompt(event.target.value)}
									rows={4}
									placeholder="e.g. hypnotic techno groove with syncopated hats and a rolling bassline"
								/>
							</div>

							<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
								<FormSelect
									label="Model"
									value={selectedModel}
									onChange={(event) => setSelectedModel(event.target.value)}
									options={[
										{ value: "", label: "Auto (Default)" },
										...textModels.map((m) => ({
											value: m.value,
											label: m.label,
										})),
									]}
								/>
								<FormSelect
									label="Style"
									value={style}
									onChange={(event) =>
										setStyle(event.target.value as StrudelStyle | "")
									}
									options={STYLE_OPTIONS.map((option) => ({
										value: option.value,
										label: option.label,
									}))}
								/>
								<FormSelect
									label="Complexity"
									value={complexity}
									onChange={(event) =>
										setComplexity(event.target.value as StrudelComplexity)
									}
									options={COMPLEXITY_OPTIONS}
								/>
								<div className="space-y-2">
									<Label htmlFor="tempo">Tempo (BPM)</Label>
									<Input
										id="tempo"
										type="number"
										inputMode="numeric"
										min={60}
										max={200}
										value={tempo}
										onChange={(event) => setTempo(event.target.value)}
										placeholder="120"
									/>
								</div>
							</div>

							<Button
								variant="primary"
								fullWidth
								icon={<Sparkles className="h-4 w-4" />}
								onClick={handleGenerate}
								isLoading={generateMutation.isPending}
							>
								Generate pattern
							</Button>
						</CardContent>
					</Card>

					<Card className="overflow-hidden">
						<CardHeader className="pb-4">
							<CardTitle>Pattern preview</CardTitle>
							<CardDescription>
								Listen to the current pattern and review the generated code.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<StrudelPlayer code={code} onChange={setCode} />
						</CardContent>
					</Card>
				</div>

				<div className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Pattern details</CardTitle>
							<CardDescription>
								Metadata used for sorting and sharing.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="pattern-name">Name</Label>
								<Input
									id="pattern-name"
									value={name}
									onChange={(event) => setName(event.target.value)}
									placeholder="Afterhours groove"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="pattern-description">Description</Label>
								<Textarea
									id="pattern-description"
									value={description}
									onChange={(event) => setDescription(event.target.value)}
									rows={3}
									placeholder="Optional notes about instrumentation, energy or structure."
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="pattern-tags">
									Tags{" "}
									<span className="text-xs font-normal text-muted-foreground">
										(optional)
									</span>
								</Label>
								<Input
									id="pattern-tags"
									value={tagsInput}
									onChange={(event) => setTagsInput(event.target.value)}
									placeholder="drums, ambient, halftime"
								/>
								<p className="text-xs text-muted-foreground">
									Use commas to separate tags for filtering.
								</p>
								{parsedTags.length > 0 && (
									<div className="flex flex-wrap gap-2 pt-1">
										{parsedTags.map((tag) => (
											<Badge key={tag} variant="outline" className="text-xs">
												{tag}
											</Badge>
										))}
									</div>
								)}
							</div>
							<Button
								variant="primary"
								fullWidth
								icon={<Save className="h-4 w-4" />}
								onClick={handleSave}
								isLoading={saveMutation.isPending}
							>
								Save Pattern
							</Button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Example patterns</CardTitle>
							<CardDescription>
								Start from a tried-and-tested groove. These load instantly—no AI
								request needed.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-2 max-h-[340px] overflow-y-auto px-4">
							{examplePatterns.map((example) => (
								<button
									key={example.id}
									type="button"
									onClick={() => handleLoadExample(example)}
									className={cn(
										"w-full rounded-lg border border-dashed border-zinc-200 px-4 py-3 text-left transition hover:border-blue-500/60 dark:border-zinc-700 dark:hover:border-blue-400/60 cursor-pointer",
										selectedExampleId === example.id &&
											"border-blue-500/80 bg-blue-500/5 dark:bg-blue-500/10",
									)}
								>
									<div className="flex items-center justify-between gap-4">
										<div>
											<p className="font-medium">{example.name}</p>
											<p className="text-sm text-muted-foreground line-clamp-2">
												{example.description}
											</p>
										</div>
										<Badge variant="outline" className="capitalize">
											{example.category}
										</Badge>
									</div>
								</button>
							))}
						</CardContent>
					</Card>
				</div>
			</div>
		</PageShell>
	);
}
