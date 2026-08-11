import { GitBranch, Pencil, Unplug } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ProjectDetail } from "@assistant/schemas";

import { Button, Card, FormSelect } from "~/components/ui";
import { useSandboxConnections, useSandboxRepositoryOptions } from "~/hooks/useSandbox";
import { useUpdateProject } from "~/hooks/useWorkspaces";

export function ProjectCodingEnvironmentCard({
	canManage,
	project,
}: {
	canManage: boolean;
	project: ProjectDetail;
}) {
	const updateProject = useUpdateProject();
	const { data: connections = [], isLoading: isLoadingConnections } = useSandboxConnections();
	const { repoOptions, isLoading: isLoadingRepositories } =
		useSandboxRepositoryOptions(connections);
	const [isEditing, setIsEditing] = useState(false);
	const [repositoryKey, setRepositoryKey] = useState("");
	const [shouldCommit, setShouldCommit] = useState(true);

	const configuredKey = project.codingEnvironment
		? `${project.codingEnvironment.installationId}:${project.codingEnvironment.repository.toLowerCase()}`
		: "";
	const selectedRepository = useMemo(
		() => repoOptions.find((option) => option.key === repositoryKey),
		[repoOptions, repositoryKey],
	);

	useEffect(() => {
		if (!isEditing) return;
		setRepositoryKey(configuredKey);
		setShouldCommit(project.codingEnvironment?.shouldCommit ?? true);
	}, [configuredKey, isEditing, project.codingEnvironment]);

	const handleSave = async () => {
		if (!selectedRepository) return;
		await updateProject.mutateAsync({
			projectId: project.id,
			input: {
				codingEnvironment: {
					installationId: selectedRepository.installationId,
					repository: selectedRepository.repo,
					promptStrategy: project.codingEnvironment?.promptStrategy ?? "auto",
					shouldCommit,
					timeoutSeconds: project.codingEnvironment?.timeoutSeconds ?? 900,
				},
			},
		});
		setIsEditing(false);
	};

	const handleDisconnect = async () => {
		await updateProject.mutateAsync({ projectId: project.id, input: { codingEnvironment: null } });
		setIsEditing(false);
	};

	const content = (
		<>
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<GitBranch size={20} className="text-zinc-500" />
					<h2 className="text-sm font-semibold">Coding repository</h2>
				</div>
				{canManage && !isEditing && (
					<Button
						variant="icon"
						icon={<Pencil size={15} />}
						aria-label="Edit coding repository"
						title="Edit coding repository"
						onClick={() => setIsEditing(true)}
					/>
				)}
			</div>

			{isEditing ? (
				<div className="space-y-4">
					<FormSelect
						label="GitHub repository"
						value={repositoryKey}
						onChange={(event) => setRepositoryKey(event.target.value)}
						disabled={isLoadingConnections || isLoadingRepositories}
						options={[
							{
								value: "",
								label: isLoadingRepositories ? "Loading repositories…" : "Choose a repository",
							},
							...repoOptions.map((option) => ({
								value: option.key,
								label: option.repo,
							})),
						]}
					/>
					<label className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
						<input
							type="checkbox"
							checked={shouldCommit}
							onChange={(event) => setShouldCommit(event.target.checked)}
							className="h-4 w-4 rounded border-zinc-300 text-blue-600"
						/>
						Create a commit when changes are ready
					</label>
					{updateProject.error && (
						<p className="text-sm text-red-700">{updateProject.error.message}</p>
					)}
					<div className="flex justify-end gap-2">
						<Button variant="secondary" onClick={() => setIsEditing(false)}>
							Cancel
						</Button>
						<Button
							variant="primary"
							size="sm"
							onClick={handleSave}
							disabled={!selectedRepository}
							isLoading={updateProject.isPending}
						>
							Save repository
						</Button>
					</div>
				</div>
			) : project.codingEnvironment ? (
				<div className="flex items-center justify-between gap-4">
					<div className="min-w-0">
						<p className="truncate font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100">
							{project.codingEnvironment.repository}
						</p>
					</div>
					{canManage && (
						<Button variant="outline" icon={<Unplug size={15} />} onClick={handleDisconnect}>
							Disconnect
						</Button>
					)}
				</div>
			) : (
				<div className="space-y-3">
					<p className="text-sm text-zinc-500">No repository connected.</p>
					{canManage && (
						<Button
							variant="primary"
							size="sm"
							fullWidth
							className="whitespace-nowrap"
							onClick={() => setIsEditing(true)}
						>
							Connect repository
						</Button>
					)}
				</div>
			)}
		</>
	);

	return <Card className="p-6 shadow-none">{content}</Card>;
}
