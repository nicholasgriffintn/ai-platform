function normaliseHostname(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[(.*)\]$/u, "$1")
    .replace(/\.+$/u, "");
}

function parseIpv4Parts(hostname: string): number[] | undefined {
  const match = hostname.match(/^(?<a>\d{1,3})\.(?<b>\d{1,3})\.(?<c>\d{1,3})\.(?<d>\d{1,3})$/u);

  if (!match?.groups) {
    return undefined;
  }

  return [match.groups.a, match.groups.b, match.groups.c, match.groups.d].map((value) =>
    Number.parseInt(value, 10),
  );
}

function isPrivateIpv4Parts(parts: number[]): boolean {
  if (parts.some((value) => Number.isNaN(value) || value > 255 || value < 0)) {
    return true;
  }

  const [first, second, third] = parts;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 192 && second === 0) ||
    (first === 198 && (second === 18 || second === 19 || (second === 51 && third === 100))) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  );
}

function parseIpv4MappedIpv6Parts(hostname: string): number[] | undefined {
  const mappedPrefix = "::ffff:";

  if (!hostname.startsWith(mappedPrefix)) {
    return undefined;
  }

  const suffix = hostname.slice(mappedPrefix.length);

  if (suffix.includes(".")) {
    return parseIpv4Parts(suffix);
  }

  const segments = suffix.split(":");

  if (segments.length !== 2) {
    return undefined;
  }

  const values = segments.map((segment) => Number.parseInt(segment, 16));

  if (values.some((value) => Number.isNaN(value) || value > 0xffff || value < 0)) {
    return undefined;
  }

  const [high, low] = values;

  return [high >> 8, high & 0xff, low >> 8, low & 0xff];
}

function isPrivateIpv6Hostname(hostname: string): boolean {
  if (
    hostname === "::" ||
    hostname === "::1" ||
    hostname === "0:0:0:0:0:0:0:0" ||
    hostname === "0:0:0:0:0:0:0:1"
  ) {
    return true;
  }

  const firstSegment = Number.parseInt(hostname.split(":")[0] || "", 16);

  if (
    !Number.isNaN(firstSegment) &&
    ((firstSegment >= 0xfe80 && firstSegment <= 0xfebf) ||
      (firstSegment >= 0xfc00 && firstSegment <= 0xfdff))
  ) {
    return true;
  }

  const mappedIpv4Parts = parseIpv4MappedIpv6Parts(hostname);

  return mappedIpv4Parts ? isPrivateIpv4Parts(mappedIpv4Parts) : false;
}

export function isLoopbackHostname(hostname: string): boolean {
  const normalised = normaliseHostname(hostname);

  return (
    normalised === "localhost" ||
    normalised.endsWith(".localhost") ||
    normalised === "::1" ||
    normalised === "0:0:0:0:0:0:0:1" ||
    /^127(?:\.\d{1,3}){3}$/u.test(normalised)
  );
}

export function isPrivateHostname(hostname: string): boolean {
  const normalised = normaliseHostname(hostname);

  if (!normalised) {
    return true;
  }

  if (
    isLoopbackHostname(normalised) ||
    normalised.endsWith(".local") ||
    normalised.endsWith(".internal") ||
    normalised.endsWith(".home.arpa")
  ) {
    return true;
  }

  if (normalised.includes(":")) {
    return isPrivateIpv6Hostname(normalised);
  }

  const ipv4Parts = parseIpv4Parts(normalised);

  return ipv4Parts ? isPrivateIpv4Parts(ipv4Parts) : false;
}
