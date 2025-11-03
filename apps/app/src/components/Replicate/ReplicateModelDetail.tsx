import { useNavigate } from "react-router";
import {
	useReplicateModels,
	useExecuteReplicateModel,
} from "~/hooks/useReplicate";
import { ReplicateModelForm } from "./ReplicateModelForm";

interface ReplicateModelDetailProps {
	modelId: string;
}

export function ReplicateModelDetail({ modelId }: ReplicateModelDetailProps) {
	const navigate = useNavigate();
	const { data: models, isLoading, error } = useReplicateModels();
	const executeMutation = useExecuteReplicateModel();

	const model = models?.find((m) => m.id === modelId);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 dark:border-zinc-100"></div>
			</div>
		);
	}

	if (error || !model) {
		return (
			<div>
				<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
					<p className="text-red-800 dark:text-red-200">
						Failed to load model. Please try again.
					</p>
				</div>
			</div>
		);
	}

	const handleSubmit = async (data: Record<string, any>) => {
		try {
			const result = await executeMutation.mutateAsync({
				modelId,
				input: data,
			});

			navigate(`/apps/replicate/predictions/${result.id}`);
		} catch (error) {
			console.error("Failed to execute model:", error);
		}
	};

	return (
		<div>
			<div className="mb-8">
				<h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
					{model.name}
				</h1>
				<p className="text-zinc-600 dark:text-zinc-400 mb-4">
					{model.description}
				</p>

				<div className="flex flex-wrap gap-2 mb-4">
					{model.type.map((type) => (
						<span
							key={type}
							className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-sm rounded-full"
						>
							{type.replace(/-/g, " ")}
						</span>
					))}
				</div>

				<div className="text-sm text-zinc-600 dark:text-zinc-400">
					Cost: ${model.costPerRun.toFixed(4)} per run
					{model.reference && (
						<>
							{" • "}
							<a
								href={model.reference}
								target="_blank"
								rel="noopener noreferrer"
								className="text-blue-600 dark:text-blue-400 no-underline hover:underline"
							>
								View documentation
							</a>
						</>
					)}
				</div>
			</div>

			{/* Form */}
			<div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-6">
				<h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
					Model Parameters
				</h2>
				<ReplicateModelForm
					model={model}
					onSubmit={handleSubmit}
					isSubmitting={executeMutation.isPending}
				/>
				{executeMutation.isError && (
					<div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
						<p className="text-red-800 dark:text-red-200">
							{executeMutation.error instanceof Error
								? executeMutation.error.message
								: "Failed to execute model. Please try again."}
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
