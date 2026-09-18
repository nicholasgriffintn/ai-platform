import {
  createWorkflows,
  type PollDefinition,
  type RawTaskDefinition,
  type ScheduleDefinition,
  type TaskDefinition,
} from "@ngriffin_uk/polychat-ai-workflows";
import type { TaskType } from "@ngriffin_uk/polychat-schemas";

import { TaskRepository } from "~/repositories/TaskRepository";
import type { IEnv } from "~/types";

import { TaskService } from "./TaskService";

export const workflows = createWorkflows<IEnv, TaskType>({
  queue: (env) => ({
    enqueue: (request) => new TaskService(env, new TaskRepository(env)).enqueueTask(request),
  }),
});

export function defineTask<TPayload>(
  definition: TaskDefinition<IEnv, TPayload, TaskType>,
): TaskDefinition<IEnv, TPayload, TaskType>;
export function defineTask(
  definition: RawTaskDefinition<IEnv, TaskType>,
): RawTaskDefinition<IEnv, TaskType>;
export function defineTask<TPayload>(
  definition: TaskDefinition<IEnv, TPayload, TaskType> | RawTaskDefinition<IEnv, TaskType>,
) {
  return definition;
}

export function definePoll<TPayload>(
  definition: PollDefinition<IEnv, TPayload, TaskType>,
): PollDefinition<IEnv, TPayload, TaskType> {
  return definition;
}

export function defineSchedule(
  definition: ScheduleDefinition<IEnv, TaskType>,
): ScheduleDefinition<IEnv, TaskType> {
  return definition;
}
