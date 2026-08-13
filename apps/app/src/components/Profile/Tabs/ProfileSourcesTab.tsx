import type { SourceKind } from "@assistant/schemas";
import { Database, FileText, Link2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "~/components/Core/EmptyState";
import { PageShell } from "~/components/Core/PageShell";
import {
	Button,
	Card,
	ConfirmationDialog,
	FormDialog,
	FormInput,
	FormSelect,
	Textarea,
} from "~/components/ui";
import { API_BASE_URL } from "~/constants";
import { useSourceCollections, useSourceMutations, useSources } from "~/hooks/useSources";
import { formatDate } from "~/lib/dates";
import { MemorySynthesisPanel } from "../MemorySynthesisPanel";

const sourceKinds: Array<{ value: "" | SourceKind; label: string }> = [
	{ value: "", label: "All sources" },
	{ value: "file", label: "Files" },
	{ value: "memory", label: "Memories" },
	{ value: "text", label: "Text" },
	{ value: "url", label: "URLs" },
	{ value: "connector", label: "Connected records" },
	{ value: "repository", label: "Repositories" },
];

interface SourcesLibraryProps {
	projectId?: string;
	title?: string;
}

export function SourcesLibrary({ projectId, title = "Sources" }: SourcesLibraryProps) {
	const [kind, setKind] = useState<"" | SourceKind>("");
	const [collectionId, setCollectionId] = useState<string | null>(null);
	const [isCreateSourceOpen, setIsCreateSourceOpen] = useState(false);
	const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
	const [sourceIdToDelete, setSourceIdToDelete] = useState<string | null>(null);
	const [collectionIdToDelete, setCollectionIdToDelete] = useState<string | null>(null);
	const [sourceTitle, setSourceTitle] = useState("");
	const [sourceContent, setSourceContent] = useState("");
	const [collectionTitle, setCollectionTitle] = useState("");
	const {
		data: sources,
		isLoading,
		error,
	} = useSources({
		projectId,
		kind: collectionId ? undefined : kind || undefined,
		collectionId,
	});
	const { data: sourceCollections } = useSourceCollections(projectId);
	const collections = sourceCollections?.filter((collection) => collection.kind !== "context");
	const mutations = useSourceMutations();
	const selectedCollection = collections?.find((collection) => collection.id === collectionId);

	return (
		<>
			<PageShell.Header
				title={title}
				actions={
					projectId
						? []
						: [
								{
									label: "Add source",
									icon: <Plus size={16} />,
									onClick: () => setIsCreateSourceOpen(true),
								},
							]
				}
			/>
			<p className="mb-6 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
				{projectId
					? "Memories and sources available to this project."
					: "Files, memories, links, repositories, and connected records available to Polychat."}
			</p>

			<div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
				<aside>
					<Card className="gap-2 p-3 shadow-none">
						<div className="flex items-center justify-between px-2 pb-1">
							<h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
								Collections
							</h2>
							<Button
								variant="icon"
								size="icon"
								icon={<Plus size={15} />}
								aria-label="Create collection"
								onClick={() => setIsCreateCollectionOpen(true)}
							/>
						</div>
						<button
							type="button"
							className={`flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm transition-colors ${
								collectionId === null
									? "bg-off-white-highlight text-black dark:bg-[#2D2D2D] dark:text-white"
									: "text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-900"
							}`}
							onClick={() => setCollectionId(null)}
						>
							<Database size={16} />
							<span className="min-w-0 flex-1 truncate">All sources</span>
						</button>
						{collections?.map((collection) => (
							<div key={collection.id} className="group flex items-center gap-1">
								<button
									type="button"
									className={`min-w-0 flex-1 rounded-lg p-2 text-left text-sm transition-colors ${
										collectionId === collection.id
											? "bg-off-white-highlight text-black dark:bg-[#2D2D2D] dark:text-white"
											: "text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-900"
									}`}
									onClick={() => setCollectionId(collection.id)}
								>
									<span className="block truncate">{collection.title}</span>
									<span className="block text-xs text-zinc-500">
										{collection.sourceCount} {collection.sourceCount === 1 ? "source" : "sources"}
									</span>
								</button>
								<Button
									variant="icon"
									size="icon"
									icon={<Trash2 size={14} />}
									aria-label={`Delete ${collection.title}`}
									className="shrink-0 md:opacity-0 md:group-hover:opacity-100"
									onClick={() => setCollectionIdToDelete(collection.id)}
								/>
							</div>
						))}
					</Card>
				</aside>

				<section className="min-w-0">
					<div className="mb-4 flex items-end justify-between gap-4">
						<div>
							<h2 className="text-lg font-semibold">
								{selectedCollection?.title ?? "All sources"}
							</h2>
							<p className="text-sm text-zinc-500">
								{selectedCollection
									? "Sources grouped in this collection."
									: "Browse and manage available source material."}
							</p>
						</div>
						{!collectionId ? (
							<FormSelect
								aria-label="Filter sources by type"
								fullWidth={false}
								value={kind}
								onChange={(event) => setKind(event.target.value as "" | SourceKind)}
								options={sourceKinds}
							/>
						) : null}
					</div>

					{!projectId ? (
						<div className="mb-4">
							<MemorySynthesisPanel />
						</div>
					) : null}

					{error ? <EmptyState title="Sources unavailable" message={error.message} /> : null}
					{!error && isLoading ? (
						<Card className="p-6 text-sm text-zinc-500 shadow-none">Loading sources…</Card>
					) : null}
					{!error && !isLoading && !sources?.length ? (
						<EmptyState
							icon={<Database size={24} className="text-zinc-400" />}
							title="No sources"
							message={
								selectedCollection
									? "Add a source to this collection from the source list."
									: "Add a source to make it available to Polychat."
							}
							className="min-h-[220px]"
						/>
					) : null}
					{!error && !isLoading && sources?.length ? (
						<Card className="gap-0 overflow-hidden py-0 shadow-none">
							{sources.map((source) => (
								<div
									key={source.id}
									className="flex items-center gap-4 border-b border-zinc-100 px-5 py-4 last:border-0 dark:border-zinc-800"
								>
									<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
										{source.kind === "url" ? <Link2 size={17} /> : <FileText size={17} />}
									</div>
									<div className="min-w-0 flex-1">
										<h3 className="truncate text-sm font-medium">{source.title}</h3>
										<p className="text-xs capitalize text-zinc-500">
											{source.kind} · {formatDate(source.updatedAt ?? source.createdAt)}
										</p>
									</div>
									{source.file ? (
										<a
											href={`${API_BASE_URL}/sources/${source.id}/content`}
											className="shrink-0 text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-300"
										>
											Open file
										</a>
									) : null}
									{!collectionId && collections?.length ? (
										<FormSelect
											aria-label={`Add ${source.title} to a collection`}
											fullWidth={false}
											defaultValue=""
											onChange={(event) => {
												if (!event.target.value) return;
												mutations.addToCollection.mutate({
													collectionId: event.target.value,
													sourceId: source.id,
												});
												event.target.value = "";
											}}
											className="max-w-40"
										>
											<option value="">Add to collection…</option>
											{collections.map((collection) => (
												<option key={collection.id} value={collection.id}>
													{collection.title}
												</option>
											))}
										</FormSelect>
									) : null}
									<Button
										variant="icon"
										size="icon"
										icon={<Trash2 size={15} />}
										aria-label={`Delete ${source.title}`}
										onClick={() => setSourceIdToDelete(source.id)}
									/>
								</div>
							))}
						</Card>
					) : null}
				</section>
			</div>

			{!projectId ? (
				<FormDialog
					open={isCreateSourceOpen}
					onOpenChange={setIsCreateSourceOpen}
					title="Add source"
					description="Add text that Polychat can use as source material."
					submitText="Add source"
					isLoading={mutations.createSource.isPending}
					submitDisabled={!sourceTitle.trim() || !sourceContent.trim()}
					onSubmit={async () => {
						await mutations.createSource.mutateAsync({
							projectId,
							kind: "text",
							title: sourceTitle.trim(),
							content: sourceContent.trim(),
							status: "available",
							metadata: {},
						});
						setSourceTitle("");
						setSourceContent("");
						setIsCreateSourceOpen(false);
						toast.success("Source added");
					}}
				>
					<FormInput
						label="Title"
						value={sourceTitle}
						onChange={(event) => setSourceTitle(event.target.value)}
						required
					/>
					<div className="space-y-1">
						<label htmlFor="source-content" className="text-sm font-medium">
							Content
						</label>
						<Textarea
							id="source-content"
							value={sourceContent}
							onChange={(event) => setSourceContent(event.target.value)}
							className="min-h-32"
							required
						/>
					</div>
				</FormDialog>
			) : null}

			<FormDialog
				open={isCreateCollectionOpen}
				onOpenChange={setIsCreateCollectionOpen}
				title="Create collection"
				description="Group related sources so they can be found together."
				submitText="Create collection"
				isLoading={mutations.createCollection.isPending}
				submitDisabled={!collectionTitle.trim()}
				onSubmit={async () => {
					await mutations.createCollection.mutateAsync({
						projectId,
						title: collectionTitle.trim(),
						kind: "general",
					});
					setCollectionTitle("");
					setIsCreateCollectionOpen(false);
					toast.success("Collection created");
				}}
			>
				<FormInput
					label="Name"
					value={collectionTitle}
					onChange={(event) => setCollectionTitle(event.target.value)}
					required
				/>
			</FormDialog>

			<ConfirmationDialog
				open={sourceIdToDelete !== null}
				onOpenChange={(open) => !open && setSourceIdToDelete(null)}
				title="Delete source"
				description="Delete this source from Polychat? This cannot be undone."
				confirmText="Delete source"
				variant="destructive"
				isLoading={mutations.deleteSource.isPending}
				onConfirm={async () => {
					if (sourceIdToDelete) await mutations.deleteSource.mutateAsync(sourceIdToDelete);
					setSourceIdToDelete(null);
				}}
			/>
			<ConfirmationDialog
				open={collectionIdToDelete !== null}
				onOpenChange={(open) => !open && setCollectionIdToDelete(null)}
				title="Delete collection"
				description="Delete this collection? Its sources will remain available."
				confirmText="Delete collection"
				variant="destructive"
				isLoading={mutations.deleteCollection.isPending}
				onConfirm={async () => {
					if (collectionIdToDelete) {
						await mutations.deleteCollection.mutateAsync(collectionIdToDelete);
						if (collectionId === collectionIdToDelete) setCollectionId(null);
					}
					setCollectionIdToDelete(null);
				}}
			/>
		</>
	);
}

export function ProfileSourcesTab() {
	return <SourcesLibrary />;
}
