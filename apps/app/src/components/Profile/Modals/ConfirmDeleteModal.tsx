import { Loader2 } from "lucide-react";

import { Button } from "~/components/ui/Button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/Dialog";

export function ConfirmDeleteModal({
	isOpen,
	onClose,
	onConfirm,
	agentName,
	isDeleting,
}: {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
	agentName: string;
	isDeleting: boolean;
}) {
	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Delete Agent</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<p className="text-sm text-muted-foreground">
						Are you sure you want to delete{" "}
						<span className="font-medium text-foreground">"{agentName}"</span>?
						This action cannot be undone.
					</p>
					<div className="flex justify-end gap-3">
						<Button variant="outline" onClick={onClose} disabled={isDeleting}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={onConfirm}
							disabled={isDeleting}
						>
							{isDeleting ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Deleting...
								</>
							) : (
								"Delete Agent"
							)}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
