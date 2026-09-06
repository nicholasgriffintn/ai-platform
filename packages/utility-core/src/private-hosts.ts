export function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/.test(hostname)
  );
}

function readIpv4(hostname: string): number[] | null {
  const parts = hostname.split(".");

  if (parts.length !== 4) {
    return null;
  }

  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : Number.NaN));

  return octets.every((octet) => Number.isInteger(octet) && octet <= 255) ? octets : null;
}

export function isPrivateHostname(hostname: string): boolean {
  if (isLoopbackHostname(hostname)) {
    return true;
  }

  const lowered = hostname.toLowerCase();

  if (lowered === "0.0.0.0" || lowered === "[::]" || lowered.endsWith(".local")) {
    return true;
  }

  if (lowered.startsWith("[")) {
    const inner = lowered.slice(1, -1);

    return (
      inner.startsWith("fe8") ||
      inner.startsWith("fe9") ||
      inner.startsWith("fea") ||
      inner.startsWith("feb") ||
      inner.startsWith("fc") ||
      inner.startsWith("fd") ||
      inner.startsWith("::ffff:")
    );
  }

  const octets = readIpv4(lowered);

  if (!octets) {
    return false;
  }

  const [first, second] = octets as [number, number, number, number];

  return (
    first === 10 ||
    first === 127 ||
    first === 0 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127)
  );
}
