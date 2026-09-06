export function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", finish);
      resolve();
    };

    const timeout = setTimeout(finish, milliseconds);

    signal?.addEventListener("abort", finish, { once: true });

    if (signal?.aborted) {
      finish();
    }
  });
}
