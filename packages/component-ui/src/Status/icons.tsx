import { Loader2, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";

export function getStatusIcon(status: string): React.ReactNode {
  switch (status) {
    case "completed":
    case "succeeded":
      return <CheckCircle2 size={16} className="text-success" />;
    case "running":
      return <Loader2 size={16} className="text-active-work animate-spin" />;
    case "failed":
      return <XCircle size={16} className="text-failure" />;
    case "pending":
    case "queued":
      return <Clock size={16} className="text-attention" />;
    case "cancelled":
      return <AlertCircle size={16} className="text-muted-foreground" />;
    default:
      return <Clock size={16} />;
  }
}
