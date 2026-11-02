export function parseClockMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/u.exec(value);

  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function isClockTimeInRange(time: string, start: string, end: string): boolean {
  const current = parseClockMinutes(time);
  const first = parseClockMinutes(start);
  const last = parseClockMinutes(end);

  if (current === null || first === null || last === null || first === last) {
    return false;
  }

  return first < last ? current >= first && current < last : current >= first || current < last;
}

export function clockTimeToDailyCron(value: string): string {
  const minutes = parseClockMinutes(value);

  if (minutes === null) {
    throw new RangeError("A daily schedule requires a valid HH:mm time");
  }

  return `${minutes % 60} ${Math.floor(minutes / 60)} * * *`;
}

export function shiftClockTime(value: string, offsetMinutes: number): string {
  const current = parseClockMinutes(value);

  if (current === null || !Number.isSafeInteger(offsetMinutes)) {
    throw new RangeError("A clock offset requires a valid time and whole minutes");
  }

  const shifted = (((current + offsetMinutes) % 1440) + 1440) % 1440;

  return `${String(Math.floor(shifted / 60)).padStart(2, "0")}:${String(shifted % 60).padStart(2, "0")}`;
}
