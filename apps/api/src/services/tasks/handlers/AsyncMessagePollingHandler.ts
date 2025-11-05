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
import { TaskRepository } from "~/repositories/TaskRepository";

const logger = getLogger({ prefix: "services/tasks/async-message-polling" });

interface AsyncMessagePollingData {
	conversationId: string;
	messageId: string;
	asyncInvocation: AsyncInvocationMetadata;
	userId: number;
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
				env,
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
					`Message ${data.messageId} is not pending async invocation`,
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

			logger.info(
				`Async invocation for message ${data.messageId} still in progress, re-queuing`,
			);

			const taskRepository = new TaskRepository(env);
			const taskService = new TaskService(env, taskRepository);

			await taskService.enqueueTask({
				task_type: "async_message_polling",
				user_id: message.user_id,
				task_data: data,
				schedule_type: "scheduled",
				scheduled_at: new Date(Date.now() + 5000).toISOString(),
				priority: message.priority || 5,
			});

			return {
				status: "success",
				message: "Async invocation still in progress, re-queued",
				data: {
					messageId: data.messageId,
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
