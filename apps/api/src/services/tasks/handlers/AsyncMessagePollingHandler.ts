import type { IEnv, Message, IUser } from "~/types";
import type { TaskMessage } from "../TaskService";
import type { TaskHandler, TaskResult } from "../TaskHandler";
import { getLogger } from "~/utils/logger";
import { ConversationManager } from "~/lib/conversationManager";
import { Database } from "~/lib/database";
import { handleAsyncInvocation } from "~/services/completions/async/handler";
import type { AsyncInvocationMetadata } from "~/lib/async/asyncInvocation";
import { isAsyncInvocationPending } from "~/lib/async/asyncInvocation";
import { TaskService } from "../TaskService";

const logger = getLogger({ prefix: "services/tasks/async-message-polling" });

interface AsyncMessagePollingData {
	conversationId: string;
	messageId: string;
	asyncInvocation: AsyncInvocationMetadata;
	userId: number;
	pollCount?: number;
}

export class AsyncMessagePollingHandler implements TaskHandler {
	public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
		try {
			const data = message.task_data as AsyncMessagePollingData;

			if (!data.conversationId || !data.messageId || !data.asyncInvocation) {
				return {
					status: "error",
					message:
						"conversationId, messageId, and asyncInvocation are required for async message polling",
				};
			}

			const database = Database.getInstance(env.DB);
			const conversationManager = ConversationManager.getInstance({
				database,
				user: { id: data.userId } as IUser,
				store: true,
			});

			const messages = await conversationManager.get(data.conversationId);
			const targetMessage = messages.find((m) => m.id === data.messageId);

			if (!targetMessage) {
				return {
					status: "error",
					message: `Message ${data.messageId} not found in conversation`,
				};
			}

			const messageAsyncInvocation = (
				targetMessage.data as Record<string, any> | undefined
			)?.asyncInvocation as AsyncInvocationMetadata | undefined;

			if (
				!messageAsyncInvocation ||
				!isAsyncInvocationPending(messageAsyncInvocation)
			) {
				logger.info(
					`Message ${data.messageId} is not pending async invocation, skipping`,
				);
				return {
					status: "success",
					message: "Message not pending async invocation",
					data: {
						messageId: data.messageId,
						status: targetMessage.status,
					},
				};
			}

			const result = await handleAsyncInvocation(
				data.asyncInvocation,
				targetMessage,
				{
					conversationManager,
					conversationId: data.conversationId,
					env,
					user: { id: data.userId } as IUser,
				},
			);

			if (result.status === "completed" || result.status === "failed") {
				logger.info(
					`Async invocation for message ${data.messageId} ${result.status}`,
				);

				return {
					status: "success",
					message: `Async invocation ${result.status}`,
					data: {
						messageId: data.messageId,
						invocationStatus: result.status,
					},
				};
			}

			const pollCount = (data.pollCount || 0) + 1;
			const maxPolls = 240; // 20 minutes at 5-second intervals

			if (pollCount >= maxPolls) {
				logger.warn(
					`Async invocation for message ${data.messageId} exceeded max poll attempts`,
				);

				const failedMessage: Message = {
					...targetMessage,
					status: "failed",
					data: {
						...(targetMessage.data || {}),
						asyncInvocation: {
							...data.asyncInvocation,
							status: "failed",
						},
						error: "Polling timeout exceeded",
					},
				};

				await conversationManager.update(data.conversationId, [failedMessage]);

				return {
					status: "error",
					message: "Async invocation polling timeout exceeded",
				};
			}

			logger.info(
				`Async invocation for message ${data.messageId} still in progress, re-queuing (attempt ${pollCount}/${maxPolls})`,
			);

			const taskService = new TaskService(
				env,
				// @ts-ignore - we'll fix this after implementing the repository access
				null,
			);

			await taskService.enqueueTask({
				task_type: "async_message_polling",
				task_data: {
					...data,
					pollCount,
				},
				schedule_type: "scheduled",
				scheduled_at: new Date(Date.now() + 5000).toISOString(),
				priority: message.priority || 5,
			});

			return {
				status: "success",
				message: `Async invocation still in progress, re-queued for polling (attempt ${pollCount})`,
				data: {
					messageId: data.messageId,
					pollCount,
				},
			};
		} catch (error) {
			logger.error("Async message polling error:", error);
			return {
				status: "error",
				message: (error as Error).message,
			};
		}
	}
}
