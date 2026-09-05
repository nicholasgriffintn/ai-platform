export function nextLocalMorning(now = new Date()): string {
  const nextMorning = new Date(now);

  nextMorning.setDate(nextMorning.getDate() + 1);
  nextMorning.setHours(9, 0, 0, 0);

  return nextMorning.toISOString();
}
