export interface AsyncEventQueue<T> {
  push: (value: T) => void;
  close: () => void;
  events: AsyncIterable<T>;
}

export function createAsyncEventQueue<T>(): AsyncEventQueue<T> {
  const pending: T[] = [];
  const waiting: ((value: T | null) => void)[] = [];
  let closed = false;

  function push(value: T): void {
    if (closed) {
      return;
    }

    const resolve = waiting.shift();

    if (resolve) {
      resolve(value);

      return;
    }

    pending.push(value);
  }

  function close(): void {
    if (closed) {
      return;
    }

    closed = true;

    while (waiting.length > 0) {
      waiting.shift()?.(null);
    }
  }

  function next(): Promise<T | null> {
    if (pending.length > 0) {
      return Promise.resolve(pending.shift() as T);
    }

    if (closed) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      waiting.push(resolve);
    });
  }

  return {
    push,
    close,
    events: {
      async *[Symbol.asyncIterator]() {
        for (let value = await next(); value !== null; value = await next()) {
          yield value;
        }
      },
    },
  };
}
