const STOP_POLL_INTERVAL_MS = 250;

export async function readStreamOrStop(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  shouldStop?: () => boolean,
): Promise<ReadableStreamReadResult<Uint8Array> | null> {
  if (!shouldStop) {
    return reader.read();
  }

  const pendingRead = reader.read();

  while (!shouldStop()) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let result: { kind: "read"; value: ReadableStreamReadResult<Uint8Array> } | { kind: "poll" };

    try {
      result = await Promise.race([
        pendingRead.then((value) => ({ kind: "read" as const, value })),
        new Promise<{ kind: "poll" }>((resolve) => {
          timer = setTimeout(() => resolve({ kind: "poll" }), STOP_POLL_INTERVAL_MS);
        }),
      ]);
    } catch (error) {
      if (timer !== undefined) {
        clearTimeout(timer);
      }

      if (!shouldStop()) {
        throw error;
      }

      break;
    }

    if (timer !== undefined) {
      clearTimeout(timer);
    }

    if (result.kind === "read") {
      return result.value;
    }
  }

  await reader.cancel().catch(() => {});
  await pendingRead.catch(() => {});

  return null;
}
