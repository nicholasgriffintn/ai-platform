import { Music2, Music4, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { StrudelPlayer } from "~/components/Strudel/StrudelPlayer";
import { StrudelCreateStudio } from "~/components/Apps/Strudel/StrudelCreateStudio";
import { EmptyState } from "~/components/Core/EmptyState";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { Badge, Button, Card, Input, Label, Textarea } from "@ngriffin_uk/polychat-component-ui";
import {
	useDeleteStrudelPattern,
	useGenerateStrudelPattern,
	useSaveStrudelPattern,
	useStrudelPattern,
	useStrudelPatterns,
	useUpdateStrudelPattern,
} from "~/hooks/useStrudel";
import { WorkCardGridSkeleton } from "../WorkLoadingSkeletons";
import { parseCommaSeparatedTags } from "@ngriffin_uk/polychat-utility-core";
import { isAuthenticationError } from "~/lib/errors";

const STARTER_PATTERN = 's("bd sd, hh*8").bank("RolandTR909").gain(0.8)';

export function StrudelExperience({ basePath, projectId, subpath }: ExperienceProps) {
	const segments = subpath.split("/").filter(Boolean);
	const patternId = segments[0] && segments[0] !== "new" ? segments[0] : undefined;
	const isNew = segments[0] === "new";
	const {
		data: patterns,
		isLoading,
		error,
	} = useStrudelPatterns(projectId, {
		enabled: !isNew && !patternId,
	});

	if (isNew) return <StrudelCreateStudio basePath={basePath} projectId={projectId} />;
	if (patternId)
		return <PatternEditor basePath={basePath} patternId={patternId} projectId={projectId} />;
	if (isLoading) return <WorkCardGridSkeleton count={4} label="Loading music patterns" />;
	if (isAuthenticationError(error)) {
		return (
			<SignInEmptyState
				title="Sign in to view project patterns"
				message="Sign in to access the patterns in this project."
			/>
		);
	}
	if (error) return <EmptyState title="Patterns unavailable" message={error.message} />;
	if (!patterns?.length) {
		return (
			<EmptyState
				icon={<Music2 size={24} className="text-zinc-400" />}
				title="No project patterns"
				message="Write or generate a live-coded music pattern."
				action={
					<Link to={`${basePath}/new`}>
						<Button variant="primary" icon={<Plus size={16} />}>
							New pattern
						</Button>
					</Link>
				}
			/>
		);
	}

	return (
		<div>
			<div className="mb-5 flex justify-end">
				<Link to={`${basePath}/new`}>
					<Button variant="primary" icon={<Plus size={16} />}>
						New pattern
					</Button>
				</Link>
			</div>
			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
				{patterns.map((pattern) => (
					<Link
						key={pattern.id}
						to={`${basePath}/${pattern.id}`}
						className="group no-underline hover:!no-underline"
					>
						<Card className="h-full gap-4 p-5 shadow-none transition hover:border-blue-500/60 dark:hover:border-blue-400/60">
							<div className="flex items-center gap-3">
								<span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-300">
									<Music4 className="h-5 w-5" />
								</span>
								<div>
									<h2 className="font-semibold text-zinc-950 group-hover:underline dark:text-white">
										{pattern.name}
									</h2>
									<p className="text-xs text-zinc-400">
										Updated {new Date(pattern.updatedAt).toLocaleDateString()}
									</p>
								</div>
							</div>
							{pattern.description && (
								<p className="line-clamp-2 text-sm leading-6 text-zinc-500">
									{pattern.description}
								</p>
							)}
							<pre className="max-h-40 overflow-hidden rounded-lg bg-zinc-100 p-3 text-xs leading-relaxed text-zinc-500 dark:bg-zinc-800">
								{pattern.code}
							</pre>
							{pattern.tags?.length ? (
								<div className="flex flex-wrap gap-2">
									{pattern.tags.map((tag) => (
										<Badge key={tag} variant="outline" className="text-xs capitalize">
											{tag}
										</Badge>
									))}
								</div>
							) : null}
						</Card>
					</Link>
				))}
			</div>
		</div>
	);
}

function PatternEditor({
	basePath,
	patternId,
	projectId,
}: {
	basePath: string;
	patternId?: string;
	projectId: string;
}) {
	const navigate = useNavigate();
	const { data: pattern, isLoading, error } = useStrudelPattern(patternId, projectId);
	const save = useSaveStrudelPattern(projectId);
	const update = useUpdateStrudelPattern(patternId, projectId);
	const remove = useDeleteStrudelPattern(projectId);
	const generate = useGenerateStrudelPattern(projectId);
	const [name, setName] = useState("Untitled pattern");
	const [description, setDescription] = useState("");
	const [tagsInput, setTagsInput] = useState("");
	const [prompt, setPrompt] = useState("");
	const [code, setCode] = useState(STARTER_PATTERN);
	const tags = useMemo(() => parseCommaSeparatedTags(tagsInput), [tagsInput]);

	useEffect(() => {
		if (!pattern) return;
		setName(pattern.name);
		setDescription(pattern.description ?? "");
		setTagsInput((pattern.tags ?? []).join(", "));
		setCode(pattern.code);
	}, [pattern]);

	if (patternId && isLoading)
		return <WorkCardGridSkeleton count={1} label="Loading music pattern" />;
	if (patternId && isAuthenticationError(error)) {
		return (
			<SignInEmptyState
				title="Sign in to view this pattern"
				message="Sign in to access this project pattern."
			/>
		);
	}
	if (patternId && (error || !pattern))
		return (
			<EmptyState title="Pattern unavailable" message={error?.message ?? "Pattern not found"} />
		);
	const mutationError = save.error ?? update.error ?? remove.error ?? generate.error;

	return (
		<div className="grid gap-5 xl:grid-cols-[1fr_20rem]">
			<StrudelPlayer code={code} onChange={setCode} />
			<Card className="h-fit gap-5 p-5 shadow-none">
				<div className="space-y-2">
					<Label htmlFor="pattern-name">Name</Label>
					<Input id="pattern-name" value={name} onChange={(event) => setName(event.target.value)} />
				</div>
				<div className="space-y-2">
					<Label htmlFor="pattern-tags">Tags (optional)</Label>
					<Input
						id="pattern-tags"
						value={tagsInput}
						onChange={(event) => setTagsInput(event.target.value)}
						placeholder="drums, ambient, halftime"
					/>
					{tags.length > 0 && (
						<div className="flex flex-wrap gap-2">
							{tags.map((tag) => (
								<Badge key={tag} variant="outline" className="text-xs">
									{tag}
								</Badge>
							))}
						</div>
					)}
				</div>
				<div className="space-y-2">
					<Label htmlFor="pattern-description">Description</Label>
					<Textarea
						id="pattern-description"
						value={description}
						onChange={(event) => setDescription(event.target.value)}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="pattern-prompt">Generate from a prompt</Label>
					<Textarea
						id="pattern-prompt"
						value={prompt}
						onChange={(event) => setPrompt(event.target.value)}
						placeholder="A warm, slow lo-fi beat"
					/>
					<Button
						variant="secondary"
						fullWidth
						icon={<Sparkles size={16} />}
						disabled={!prompt.trim()}
						isLoading={generate.isPending}
						onClick={async () => {
							const result = await generate.mutateAsync({ prompt: prompt.trim() });
							setCode(result.code);
						}}
					>
						Generate pattern
					</Button>
				</div>
				{isAuthenticationError(mutationError) ? (
					<SignInEmptyState
						title="Sign in to save patterns"
						message="Sign in to save and update patterns in this project."
					/>
				) : (
					mutationError && <p className="text-sm text-red-700">{mutationError.message}</p>
				)}
				<div className="flex gap-2">
					<Button
						variant="primary"
						className="flex-1"
						disabled={!name.trim() || !code.trim()}
						isLoading={save.isPending || update.isPending}
						onClick={async () => {
							if (patternId) {
								await update.mutateAsync({
									name: name.trim(),
									description: description.trim() || undefined,
									code,
									tags,
								});
							} else {
								const created = await save.mutateAsync({
									name: name.trim(),
									description: description.trim() || undefined,
									code,
									tags,
								});
								navigate(`${basePath}/${created.id}`, { replace: true });
							}
						}}
					>
						Save
					</Button>
					{patternId && (
						<Button
							variant="destructive"
							aria-label="Delete pattern"
							icon={<Trash2 size={16} />}
							isLoading={remove.isPending}
							onClick={async () => {
								await remove.mutateAsync(patternId);
								navigate(basePath);
							}}
						/>
					)}
				</div>
			</Card>
		</div>
	);
}

interface ExperienceProps {
	basePath: string;
	projectId: string;
	subpath: string;
}
