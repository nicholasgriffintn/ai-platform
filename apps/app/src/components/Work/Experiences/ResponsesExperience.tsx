import { Check, Link2, Puzzle, Share2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { ResponseRenderer } from "~/components/Apps/ResponseRenderer";
import { EmptyState } from "~/components/Core/EmptyState";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { Button, Card } from "~/components/ui";
import {
	useCreateOutputShare,
	useOutput,
	useOutputs,
	useOutputShares,
	useRevokeOutputShare,
} from "~/hooks/useOutputs";
import { formatDate } from "~/lib/dates";
import { isAuthenticationError } from "~/lib/errors";
import { WorkCardGridSkeleton } from "../WorkLoadingSkeletons";

export function ResponsesExperience({ basePath, projectId, subpath }: ExperienceProps) {
	const [shareCopied, setShareCopied] = useState(false);
	const createShare = useCreateOutputShare();
	const revokeShare = useRevokeOutputShare();
	const outputId = subpath.split("/").filter(Boolean)[0];
	const { data: shares } = useOutputShares(outputId ?? null);
	const {
		data: outputs,
		isLoading,
		error,
	} = useOutputs(projectId, undefined, {
		enabled: !outputId,
	});
	const {
		data: output,
		isLoading: isOutputLoading,
		error: outputError,
	} = useOutput(outputId ?? null);

	if (outputId) {
		if (isOutputLoading) return <WorkCardGridSkeleton count={1} label="Loading output" />;
		if (isAuthenticationError(outputError)) {
			return (
				<SignInEmptyState
					title="Sign in to view this output"
					message="Sign in to access this project output."
				/>
			);
		}
		if (outputError || !output)
			return (
				<EmptyState
					title="Output unavailable"
					message={outputError?.message ?? "Output not found"}
				/>
			);
		return (
			<Card className="gap-5 p-6 shadow-none">
				<div className="flex items-start justify-between gap-4">
					<div>
						<p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
							{output.capabilityId}
						</p>
						<h1 className="mt-1 text-xl font-semibold text-zinc-950 dark:text-white">
							{output.title}
						</h1>
					</div>
					<Button
						variant="outline"
						disabled={createShare.isPending}
						onClick={async () => {
							const { token } = await createShare.mutateAsync({ outputId: output.id });
							await navigator.clipboard.writeText(`${window.location.origin}/o/${token}`);
							setShareCopied(true);
						}}
					>
						{shareCopied ? <Check size={16} /> : <Share2 size={16} />}
						{shareCopied ? "Link copied" : "Share"}
					</Button>
				</div>
				<ResponseRenderer result={output.content} />
				{shares?.length ? (
					<section className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
						<div className="mb-3">
							<h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
								Active share links
							</h2>
							<p className="mt-1 text-xs text-zinc-500">
								Anyone with one of these links can view this output.
							</p>
						</div>
						<div className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
							{shares.map((share) => (
								<div key={share.id} className="flex items-center gap-3 px-3 py-2.5">
									<Link2 size={15} className="shrink-0 text-zinc-400" />
									<div className="min-w-0 flex-1">
										<p className="text-sm font-medium">Share link</p>
										<p className="text-xs text-zinc-500">
											Created {formatDate(share.createdAt)}
											{share.expiresAt ? ` · Expires ${formatDate(share.expiresAt)}` : ""}
										</p>
									</div>
									<Button
										type="button"
										size="sm"
										variant="outline"
										icon={<Trash2 size={14} />}
										isLoading={revokeShare.isPending && revokeShare.variables?.shareId === share.id}
										onClick={() => revokeShare.mutate({ outputId: output.id, shareId: share.id })}
									>
										Revoke
									</Button>
								</div>
							))}
						</div>
					</section>
				) : null}
			</Card>
		);
	}
	if (isLoading) return <WorkCardGridSkeleton count={4} label="Loading outputs" />;
	if (isAuthenticationError(error)) {
		return (
			<SignInEmptyState
				title="Sign in to view project outputs"
				message="Sign in to access the outputs in this project."
			/>
		);
	}
	if (error) return <EmptyState title="Outputs unavailable" message={error.message} />;
	if (!outputs?.length)
		return (
			<EmptyState
				icon={<Puzzle size={24} className="text-zinc-400" />}
				title="No project outputs"
				message="Run a project capability to save its output here."
			/>
		);

	return (
		<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
			{outputs.map((item) => {
				return (
					<Link
						key={item.id}
						to={`${basePath}/${item.id}`}
						className="group no-underline hover:!no-underline"
					>
						<Card className="h-full gap-3 p-5 shadow-none hover:border-zinc-400 dark:hover:border-zinc-600">
							<p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
								{item.capabilityId}
							</p>
							<h2 className="font-semibold text-zinc-950 group-hover:underline dark:text-white">
								{item.title}
							</h2>
							<p className="mt-auto pt-3 text-xs text-zinc-400">
								{new Date(item.updatedAt ?? item.createdAt).toLocaleString()}
							</p>
						</Card>
					</Link>
				);
			})}
		</div>
	);
}

interface ExperienceProps {
	basePath: string;
	projectId: string;
	subpath: string;
}
