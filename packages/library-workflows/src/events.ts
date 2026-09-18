export type EventMap = Record<string, unknown>;

export type EventHandler<TPayload> = (payload: TPayload) => Promise<void> | void;

export interface EventBus<TEvents extends EventMap> {
  on<TName extends keyof TEvents & string>(
    event: TName,
    handler: EventHandler<TEvents[TName]>,
  ): () => void;
  once<TName extends keyof TEvents & string>(
    event: TName,
    handler: EventHandler<TEvents[TName]>,
  ): () => void;
  emit<TName extends keyof TEvents & string>(event: TName, payload: TEvents[TName]): Promise<void>;
  listenerCount(event: keyof TEvents & string): number;
}

export function createEventBus<TEvents extends EventMap>(): EventBus<TEvents> {
  const handlers = new Map<string, Set<EventHandler<never>>>();

  const on: EventBus<TEvents>["on"] = (event, handler) => {
    const set = handlers.get(event) ?? new Set<EventHandler<never>>();

    set.add(handler);
    handlers.set(event, set);

    return () => {
      set.delete(handler);
    };
  };

  return {
    on,
    once: (event, handler) => {
      const off = on(event, async (payload) => {
        off();
        await handler(payload);
      });

      return off;
    },
    emit: async (event, payload) => {
      const listeners = Array.from(handlers.get(event) ?? []);

      for (const handler of listeners) {
        await (handler as EventHandler<typeof payload>)(payload);
      }
    },
    listenerCount: (event) => handlers.get(event)?.size ?? 0,
  };
}
