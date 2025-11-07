import { Save, Trash2, Undo2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { BackLink } from "~/components/Core/BackLink";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { AppsSidebarContent } from "~/components/Sidebar/AppsSidebarContent";
import { StrudelPlayer } from "~/components/Strudel/StrudelPlayer";
import {
	Alert,
	AlertDescription,
	AlertTitle,
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Input,
	Label,
	Textarea,
} from "~/components/ui";
import { ConfirmationDialog } from "~/components/ui/ConfirmationDialog";
import { CardSkeleton } from "~/components/ui/skeletons";
import {
	useDeleteStrudelPattern,
	useStrudelPattern,
	useUpdateStrudelPattern,
} from "~/hooks/useStrudel";

const parseTagsInput = (value: string): string[] =>
	value
		.split(",")
		.map((tag) => tag.trim())
		.filter(Boolean);

const formatTagsForInput = (tags?: string[]) =>
	(tags ?? []).filter(Boolean).join(", ");

const arraysEqual = (a: string[], b: string[]) =>
	a.length === b.length && a.every((value, index) => value === b[index]);

export function meta() {
	return [
		{ title: "Strudel Pattern Details - Polychat" },
		{
			name: "description",
			content: "Edit, play, and manage your saved Strudel music patterns.",
		},
	];
}

export default function StrudelPatternDetailPage() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [tagsInput, setTagsInput] = useState("");
	const [code, setCode] = useState("");
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

	const { data: pattern, isLoading, error } = useStrudelPattern(id);
	const updateMutation = useUpdateStrudelPattern(id);
	const deleteMutation = useDeleteStrudelPattern();

	useEffect(() => {
		if (pattern) {
			setName(pattern.name);
			setDescription(pattern.description ?? "");
			setTagsInput(formatTagsForInput(pattern.tags));
			setCode(pattern.code);
		}
	}, [pattern]);

	const parsedTags = useMemo(() => parseTagsInput(tagsInput), [tagsInput]);

	const hasChanges = useMemo(() => {
		if (!pattern) return false;
		const normalizedTags = (pattern.tags ?? []).map((tag) => tag.trim());
		return (
			pattern.name !== name ||
			(pattern.description ?? "") !== description ||
			pattern.code !== code ||
			!arraysEqual(parsedTags, normalizedTags)
		);
	}, [pattern, name, description, code, parsedTags]);

	const handleReset = () => {
		if (!pattern) return;
		setName(pattern.name);
		setDescription(pattern.description ?? "");
		setTagsInput(formatTagsForInput(pattern.tags));
		setCode(pattern.code);
	};

	const handleSave = async () => {
		if (!id || !pattern) return;
		if (!name.trim()) {
			toast.error("A name is required");
			return;
		}

		try {
			await updateMutation.mutateAsync({
				name: name.trim(),
				description: description.trim() || undefined,
				code,
				tags: parsedTags,
			});
			toast.success("Pattern updated");
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to update pattern",
			);
		}
	};

	const handleDelete = async () => {
		if (!id) return;
		try {
			await deleteMutation.mutateAsync(id);
			toast.success("Pattern deleted");
			navigate("/apps/strudel", { replace: true });
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to delete pattern",
			);
		}
	};

	const headerContent = (
		<div className="flex flex-wrap items-start justify-between gap-4">
			<PageHeader>
				<BackLink to="/apps/strudel" label="Back to Strudel" />
				<PageTitle title={pattern?.name ?? "Strudel Pattern"} />
				{pattern?.description && (
					<p className="text-sm text-muted-foreground">{pattern.description}</p>
				)}
			</PageHeader>
			<div className="flex flex-wrap gap-2">
				<Button
					variant="outline"
					icon={<Undo2 className="h-4 w-4" />}
					onClick={handleReset}
					disabled={!pattern || !hasChanges || updateMutation.isPending}
				>
					Reset
				</Button>
				<Button
					variant="primary"
					icon={<Save className="h-4 w-4" />}
					onClick={handleSave}
					disabled={!pattern || !hasChanges}
					isLoading={updateMutation.isPending}
				>
					Save changes
				</Button>
				<Button
					variant="destructive"
					icon={<Trash2 className="h-4 w-4" />}
					onClick={() => setIsDeleteDialogOpen(true)}
					disabled={deleteMutation.isPending}
				>
					Delete
				</Button>
			</div>
		</div>
	);

	return (
		<PageShell
			sidebarContent={<AppsSidebarContent />}
			className="max-w-7xl mx-auto"
			headerContent={headerContent}
		>
			{isLoading ? (
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<CardSkeleton count={2} />
				</div>
			) : error ? (
				<Alert variant="destructive" className="flex flex-col gap-3">
					<AlertTitle>Unable to load this pattern</AlertTitle>
					<AlertDescription className="space-y-3">
						<p>
							{error instanceof Error
								? error.message
								: "Unknown error occurred"}
						</p>
						<Button onClick={() => navigate("/apps/strudel")}>
							Return to library
						</Button>
					</AlertDescription>
				</Alert>
			) : !pattern ? (
				<Alert variant="warning">
					<AlertTitle>Pattern not found</AlertTitle>
					<AlertDescription>
						This Strudel pattern may have been deleted or never existed.
					</AlertDescription>
				</Alert>
			) : (
				<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle>Pattern details</CardTitle>
								<CardDescription>
									Update the metadata for this Strudel loop.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="pattern-name">Name</Label>
									<Input
										id="pattern-name"
										value={name}
										onChange={(event) => setName(event.target.value)}
										placeholder="Granular pads"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="pattern-description">Description</Label>
									<Textarea
										id="pattern-description"
										value={description}
										onChange={(event) => setDescription(event.target.value)}
										rows={3}
										placeholder="Explain the mood, structure, or use cases for this pattern."
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
										Use commas to separate tags. They help with filtering and
										search.
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
							</CardContent>
						</Card>

						<Card className="overflow-hidden">
							<CardHeader className="pb-4">
								<CardTitle>Pattern preview</CardTitle>
								<CardDescription>
									Listen to the saved pattern and review its Strudel code.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<StrudelPlayer code={code} />
								<div className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-sm font-mono text-muted-foreground whitespace-pre-wrap break-words max-h-64 overflow-auto">
									{code || "// No pattern code available"}
								</div>
							</CardContent>
						</Card>
					</div>

					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle>Timeline</CardTitle>
								<CardDescription>
									Creation details for this pattern.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3 text-sm text-muted-foreground">
								<div>
									<p className="text-xs uppercase tracking-wide text-muted-foreground/80">
										Created
									</p>
									<p className="text-base text-foreground">
										{new Date(pattern.createdAt).toLocaleString()}
									</p>
								</div>
								<div>
									<p className="text-xs uppercase tracking-wide text-muted-foreground/80">
										Last updated
									</p>
									<p className="text-base text-foreground">
										{new Date(pattern.updatedAt).toLocaleString()}
									</p>
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			)}

			<ConfirmationDialog
				open={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
				title="Delete Strudel pattern"
				description="This action permanently removes the pattern and cannot be undone."
				confirmText="Delete pattern"
				variant="destructive"
				onConfirm={handleDelete}
				isLoading={deleteMutation.isPending}
			/>
		</PageShell>
	);
}
