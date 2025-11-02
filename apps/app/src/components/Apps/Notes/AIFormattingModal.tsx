import { Loader2 } from "lucide-react";
import { memo } from "react";

import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Textarea as UITextarea,
} from "~/components/ui";

interface AIFormattingModalProps {
	isOpen: boolean;
	onClose: () => void;
	aiPrompt: string;
	setAIPrompt: (prompt: string) => void;
	aiResult: string;
	formatNoteMutation: {
		status: "idle" | "pending" | "success" | "error";
	};
	runFormat: () => void;
	onAccept: (result: string) => void;
	noteId?: string;
}

export const AIFormattingModal = memo(function AIFormattingModal({
	isOpen,
	onClose,
	aiPrompt,
	setAIPrompt,
	aiResult,
	formatNoteMutation,
	runFormat,
	onAccept,
	noteId,
}: AIFormattingModalProps) {
	const handleAccept = () => {
		onAccept(aiResult);
		onClose();
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose} width="600px">
			<DialogContent>
				<DialogHeader>
					<DialogTitle>AI Formatting</DialogTitle>
					<DialogDescription>
						Review and re-prompt AI suggestions
					</DialogDescription>
				</DialogHeader>
				<div className="mt-2 space-y-4">
					{formatNoteMutation.status === "idle" ? (
						<>
							<p className="text-sm">
								This feature restructures and refines your note for clarity and
								organization.
							</p>
							<p className="text-sm">
								Add additional instructions below, then click Run to format.
							</p>
						</>
					) : (
						<div className="mb-4 h-48 border rounded">
							{formatNoteMutation.status === "pending" ? (
								<div className="flex items-center justify-center h-full">
									<Loader2 className="animate-spin text-gray-500" />
								</div>
							) : formatNoteMutation.status === "error" ? (
								<p className="text-red-500 p-4">
									Formatting failed. Try again.
								</p>
							) : (
								<>
									<label htmlFor="ai-result" className="sr-only">
										AI Result
									</label>
									<UITextarea
										id="ai-result"
										value={aiResult}
										readOnly
										className="h-full"
									/>
								</>
							)}
						</div>
					)}
					<label htmlFor="ai-prompt" className="sr-only">
						Additional instructions
					</label>
					<UITextarea
						id="ai-prompt"
						value={aiPrompt}
						onChange={(e) => setAIPrompt(e.target.value)}
						placeholder="Add more instructions..."
						className="mb-4 h-24"
					/>
					<DialogFooter>
						<Button
							variant="secondary"
							onClick={runFormat}
							isLoading={formatNoteMutation.status === "pending"}
							disabled={!noteId || formatNoteMutation.status === "pending"}
							className="mr-2"
						>
							{formatNoteMutation.status === "pending"
								? "Running..."
								: "Run Formatting"}
						</Button>
						<Button
							variant="primary"
							onClick={handleAccept}
							disabled={formatNoteMutation.status !== "success"}
						>
							Accept
						</Button>
					</DialogFooter>
				</div>
			</DialogContent>
		</Dialog>
	);
});
