import { TaskError } from "./errors.js";

export interface TaskHandlerRegistry<THandler> {
  register(type: string, handler: THandler): void;
  resolve(type: string): THandler;
  has(type: string): boolean;
  types(): string[];
}

export function createTaskHandlerRegistry<THandler>(
  initial: Record<string, THandler> = {},
): TaskHandlerRegistry<THandler> {
  const handlers = new Map<string, THandler>(Object.entries(initial));

  return {
    register: (type, handler) => {
      if (handlers.has(type)) {
        throw new TaskError("duplicate_handler", `A handler for "${type}" is already registered`, {
          type,
        });
      }

      handlers.set(type, handler);
    },
    resolve: (type) => {
      const handler = handlers.get(type);

      if (!handler) {
        throw new TaskError("unknown_handler", `No handler is registered for "${type}"`, { type });
      }

      return handler;
    },
    has: (type) => handlers.has(type),
    types: () => [...handlers.keys()],
  };
}
