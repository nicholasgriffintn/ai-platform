export async function runEachSettled<T>(
  items: Iterable<T>,
  run: (item: T) => Promise<unknown>,
): Promise<void> {
  const failures: unknown[] = [];

  for (const item of items) {
    try {
      await run(item);
    } catch (error) {
      failures.push(error);
    }
  }

  if (failures.length === 1) {
    throw failures[0];
  }

  if (failures.length > 1) {
    throw new AggregateError(failures, `${failures.length} items failed`);
  }
}
