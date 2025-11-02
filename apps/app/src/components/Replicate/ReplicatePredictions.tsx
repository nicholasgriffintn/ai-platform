import { Link } from "react-router";
import { useReplicatePredictions } from "~/hooks/useReplicate";
import { EmptyState } from "~/components/Core/EmptyState";
import { Card } from "~/components/ui";

export function ReplicatePredictions() {
	const { data: predictions, isLoading, error } = useReplicatePredictions();

	if (isLoading) {
		return (
			<div className="flex justify-center items-center min-h-[400px]">
				<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-4 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-800">
				<h3 className="font-semibold mb-2">Failed to load predictions</h3>
				<p>Please try again later.</p>
			</div>
		);
	}

	if (!predictions || predictions.length === 0) {
		return (
			<EmptyState
				title="No predictions yet"
				message="You haven't created any predictions yet. Explore models to get started."
				action={
					<Link
						to="/apps/replicate"
						className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
					>
						Explore Models
					</Link>
				}
			/>
		);
	}

	return (
		<div className="space-y-4">
			{predictions.map((prediction) => (
				<PredictionCard key={prediction.id} prediction={prediction} />
			))}
		</div>
	);
}

interface PredictionCardProps {
	prediction: any;
}

function PredictionCard({ prediction }: PredictionCardProps) {
	const statusColors = {
		processing:
			"bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
		succeeded:
			"bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
		failed: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
	};

	return (
		<Link
			to={`/apps/replicate/predictions/${prediction.id}`}
			className="block no-underline"
		>
			<Card className="p-6 hover:shadow-lg transition-all">
				<div className="flex items-start justify-between mb-4">
					<div className="flex-1">
						<h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
							{prediction.modelName || prediction.modelId}
						</h3>
						<p className="text-sm text-zinc-500 dark:text-zinc-400">
							{new Date(prediction.created_at).toLocaleString()}
						</p>
					</div>
					<span
						className={`px-3 py-1 text-xs font-medium rounded-full ${
							statusColors[prediction.status as keyof typeof statusColors]
						}`}
					>
						{prediction.status}
					</span>
				</div>

				{prediction.status === "processing" && (
					<div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
						<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-zinc-600 dark:border-zinc-400"></div>
						<span>Processing...</span>
					</div>
				)}

				{prediction.status === "failed" && prediction.error && (
					<p className="text-sm text-red-600 dark:text-red-400">
						Error: {prediction.error}
					</p>
				)}
			</Card>
		</Link>
	);
}
