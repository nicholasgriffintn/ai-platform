import "../styles.css";

export interface TrainingStatusBadgeProps {
	status: string;
}

export function TrainingStatusBadge({ status }: TrainingStatusBadgeProps) {
	return (
		<span className="polychat-experience-training-status" data-tone={getStatusTone(status)}>
			{status}
		</span>
	);
}

function getStatusTone(status: string): "neutral" | "info" | "success" | "warning" | "danger" {
	switch (status.toLowerCase()) {
		case "running":
		case "processing":
		case "deploying":
			return "info";
		case "completed":
		case "succeeded":
		case "ready":
			return "success";
		case "queued":
		case "pending":
		case "paused":
			return "warning";
		case "failed":
		case "cancelled":
		case "error":
			return "danger";
		default:
			return "neutral";
	}
}
