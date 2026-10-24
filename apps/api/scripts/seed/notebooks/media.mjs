export function timeline(durations) {
  let start = 0;

  return durations.map((duration) => {
    const span = { start: Number(start.toFixed(2)), end: Number((start + duration).toFixed(2)) };

    start += duration;

    return span;
  });
}
