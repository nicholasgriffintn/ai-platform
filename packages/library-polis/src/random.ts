export interface Seeded {
  rng: number;
}

export function random(source: Seeded): number {
  source.rng = (source.rng + 0x6d2b79f5) | 0;

  let t = source.rng;

  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomInt(source: Seeded, exclusiveMax: number): number {
  return Math.floor(random(source) * exclusiveMax);
}

export function normal(source: Seeded): number {
  const u = Math.max(random(source), 1e-9);

  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random(source));
}

export function hash32(value: number): number {
  let x = value | 0;

  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);

  return (x ^ (x >>> 16)) >>> 0;
}

export function seedFromText(text: string): number {
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  }

  return hash | 0;
}
