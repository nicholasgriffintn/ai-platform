import {
	Loader2,
	CheckCircle2,
	XCircle,
	Clock,
	AlertCircle,
} from "lucide-react";

export function getStatusIcon(status: string): React.ReactNode {
	switch (status) {
		case "completed":
			return <CheckCircle2 size={16} className="text-green-600" />;
		case "running":
			return <Loader2 size={16} className="text-blue-600 animate-spin" />;
		case "failed":
			return <XCircle size={16} className="text-red-600" />;
		case "pending":
		case "queued":
			return <Clock size={16} className="text-yellow-600" />;
		case "cancelled":
			return <AlertCircle size={16} className="text-gray-600" />;
		default:
			return <Clock size={16} />;
	}
}
