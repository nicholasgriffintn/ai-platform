const NUMERIC_PART = /^\d+$/;

function splitVersion(version: string): { release: number[]; prerelease: string[] } {
  const [core = "", prerelease = ""] = version.trim().replace(/^v/, "").split("+")[0].split("-", 2);

  return {
    release: core.split(".").map((part) => (NUMERIC_PART.test(part) ? Number(part) : Number.NaN)),
    prerelease: prerelease === "" ? [] : prerelease.split("."),
  };
}

function comparePrereleaseParts(left: string, right: string): number {
  const leftNumeric = NUMERIC_PART.test(left);
  const rightNumeric = NUMERIC_PART.test(right);

  if (leftNumeric && rightNumeric) {
    return Number(left) - Number(right);
  }

  if (leftNumeric !== rightNumeric) {
    return leftNumeric ? -1 : 1;
  }

  return left === right ? 0 : left < right ? -1 : 1;
}

export function compareSemanticVersions(left: string, right: string): number {
  const first = splitVersion(left);
  const second = splitVersion(right);
  const length = Math.max(first.release.length, second.release.length);

  for (let index = 0; index < length; index += 1) {
    const a = first.release[index] ?? 0;
    const b = second.release[index] ?? 0;

    if (Number.isNaN(a) || Number.isNaN(b)) {
      return 0;
    }

    if (a !== b) {
      return a - b;
    }
  }

  if (first.prerelease.length === 0 && second.prerelease.length === 0) {
    return 0;
  }

  if (first.prerelease.length === 0) {
    return 1;
  }

  if (second.prerelease.length === 0) {
    return -1;
  }

  const prereleaseLength = Math.max(first.prerelease.length, second.prerelease.length);

  for (let index = 0; index < prereleaseLength; index += 1) {
    const a = first.prerelease[index];
    const b = second.prerelease[index];

    if (a === undefined) {
      return -1;
    }

    if (b === undefined) {
      return 1;
    }

    const comparison = comparePrereleaseParts(a, b);

    if (comparison !== 0) {
      return comparison;
    }
  }

  return 0;
}

export function isNewerVersion(candidate: string, current: string): boolean {
  return compareSemanticVersions(candidate, current) > 0;
}
