import { Send } from "lucide-react";

import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Textarea,
} from "~/components/ui";
import { formatRelativeTime } from "~/lib/dates";
import { cn } from "~/lib/utils";

import type { ChatMessage } from "./types";

interface Props {
	messages: ChatMessage[];
	instructionRunId: string | undefined;
	operatorMessage: string;
	setOperatorMessage: (v: string) => void;
	isInstructionPending: boolean;
	onSubmitInstruction: (kind: "message" | "continue") => void;
}

export function ConversationCard({
	messages,
	instructionRunId,
	operatorMessage,
	setOperatorMessage,
	isInstructionPending,
	onSubmitInstruction,
}: Props) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Conversation</CardTitle>
				<CardDescription>
					Request and outcome messages for the selected run.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="max-h-80 overflow-auto">
					{messages.length === 0 ? (
						<div className="text-sm text-muted-foreground">
							No messages yet. Submit a task to start.
						</div>
					) : (
						<div className="space-y-3">
							{messages.map((message) => (
								<div
									key={message.id}
									className={cn(
										"rounded-lg border p-3 text-sm",
										message.role === "user"
											? "bg-blue-600/5 border-blue-600/20"
											: "bg-card",
									)}
								>
									<div className="mb-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
										<span className="font-medium uppercase tracking-wide">
											{message.role}
										</span>
										<span>{formatRelativeTime(message.createdAt)}</span>
									</div>
									<p className="whitespace-pre-wrap break-words">
										{message.content}
									</p>
								</div>
							))}
						</div>
					)}
				</div>
				<div className="rounded-md border p-3">
					<div className="mb-2 text-xs text-muted-foreground">
						{instructionRunId
							? "Send instructions while the run is active."
							: "Select an active run to message the agent."}
					</div>
					<Textarea
						rows={3}
						value={operatorMessage}
						onChange={(event) => setOperatorMessage(event.target.value)}
						placeholder="Tell the agent what to prioritise or clarify while it runs."
						disabled={!instructionRunId}
					/>
					<div className="mt-2 flex flex-wrap justify-end gap-2">
						<Button
							variant="secondary"
							size="sm"
							onClick={() => onSubmitInstruction("continue")}
							disabled={!instructionRunId}
							isLoading={isInstructionPending}
						>
							Continue run
						</Button>
						<Button
							variant="primary"
							size="sm"
							icon={<Send className="h-3.5 w-3.5" />}
							onClick={() => onSubmitInstruction("message")}
							disabled={
								!instructionRunId || operatorMessage.trim().length === 0
							}
							isLoading={isInstructionPending}
						>
							Send message
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
