import { Badge } from "~/components/ui";
import { cn } from "~/lib/utils";
import { getStatusClassName } from "./utils";

interface TrainingStatusBadgeProps {
	status: string;
}

export function TrainingStatusBadge({ status }: TrainingStatusBadgeProps) {
	return (
		<Badge variant="outline" className={cn("capitalize", getStatusClassName(status))}>
			{status}
		</Badge>
	);
}
