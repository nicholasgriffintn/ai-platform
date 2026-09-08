export interface JsonRpcTransport {
  send(payload: string): Promise<void>;
}

export interface JsonRpcServerRequest {
  id: string | number;
  method: string;
  params: unknown;
}

export interface JsonRpcNotification {
  method: string;
  params: unknown;
}

export interface JsonRpcClientOptions {
  transport: JsonRpcTransport;
  onNotification: (notification: JsonRpcNotification) => void;
  onServerRequest: (request: JsonRpcServerRequest) => void;
  requestTimeoutMs?: number;
}

export class JsonRpcError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = "JsonRpcError";
    this.code = code;
  }
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export class JsonRpcClient {
  #transport: JsonRpcTransport;
  #onNotification: (notification: JsonRpcNotification) => void;
  #onServerRequest: (request: JsonRpcServerRequest) => void;
  #timeoutMs: number;
  #pending = new Map<number, PendingRequest>();
  #nextId = 1;
  #closed = false;

  constructor(options: JsonRpcClientOptions) {
    this.#transport = options.transport;
    this.#onNotification = options.onNotification;
    this.#onServerRequest = options.onServerRequest;
    this.#timeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  }

  async request<T>(method: string, params?: unknown): Promise<T> {
    if (this.#closed) {
      throw new JsonRpcError(-32000, "The agent session has closed.");
    }

    const id = this.#nextId++;
    const settled = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new JsonRpcError(-32001, `The agent did not answer ${method} in time.`));
      }, this.#timeoutMs);

      this.#pending.set(id, { resolve, reject, timer });
    });

    await this.#transport.send(JSON.stringify({ id, method, params: params ?? {} }));

    return (await settled) as T;
  }

  async notify(method: string, params?: unknown): Promise<void> {
    if (this.#closed) {
      return;
    }

    await this.#transport.send(JSON.stringify({ method, params: params ?? {} }));
  }

  async respond(id: string | number, result: unknown): Promise<void> {
    if (this.#closed) {
      return;
    }

    await this.#transport.send(JSON.stringify({ id, result }));
  }

  async respondWithError(id: string | number, code: number, message: string): Promise<void> {
    if (this.#closed) {
      return;
    }

    await this.#transport.send(JSON.stringify({ id, error: { code, message } }));
  }

  receive(line: string): void {
    let message: unknown;

    try {
      message = JSON.parse(line);
    } catch {
      return;
    }

    if (!isRecord(message)) {
      return;
    }

    if (typeof message.method === "string") {
      if (message.id === undefined || message.id === null) {
        this.#onNotification({ method: message.method, params: message.params });

        return;
      }

      if (typeof message.id === "string" || typeof message.id === "number") {
        this.#onServerRequest({
          id: message.id,
          method: message.method,
          params: message.params,
        });
      }

      return;
    }

    if (typeof message.id !== "number") {
      return;
    }

    const pending = this.#pending.get(message.id);

    if (!pending) {
      return;
    }

    this.#pending.delete(message.id);
    clearTimeout(pending.timer);

    if (isRecord(message.error)) {
      const code = typeof message.error.code === "number" ? message.error.code : -32603;
      const detail =
        typeof message.error.message === "string"
          ? message.error.message
          : "The agent reported an error it did not describe.";

      pending.reject(new JsonRpcError(code, detail));

      return;
    }

    pending.resolve(message.result);
  }

  close(reason: string): void {
    if (this.#closed) {
      return;
    }

    this.#closed = true;

    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new JsonRpcError(-32000, reason));
    }

    this.#pending.clear();
  }
}
