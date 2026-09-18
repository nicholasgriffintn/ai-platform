export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];

  if (items.length === 0) {
    return results;
  }

  results.length = items.length;

  const workerCount = Math.min(Math.max(1, Math.floor(concurrency)), items.length);

  let nextIndex = 0;
  let failed = false;

  const worker = async (): Promise<void> => {
    while (!failed && nextIndex < items.length) {
      const index = nextIndex;

      nextIndex += 1;

      try {
        results[index] = await mapper(items[index], index);
      } catch (error) {
        failed = true;

        throw error;
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, worker));

  return results;
}
