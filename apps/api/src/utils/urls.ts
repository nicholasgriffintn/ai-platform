export function appendUrlPath(baseUrl: string, path: string): string {
	return new URL(path.replace(/^\/+/, ""), `${baseUrl.replace(/\/+$/, "")}/`).toString();
}

export function normaliseHttpOrigin(value: string | undefined): string | null {
	const candidate = value?.trim();
	if (!candidate) {
		return null;
	}

	try {
		const url = new URL(candidate.startsWith("http") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") {
			return null;
		}
		return url.origin;
	} catch {
		return null;
	}
}

const normalizeHostname = (hostname: string): string =>
	hostname
		.trim()
		.toLowerCase()
		.replace(/^\[(.*)\]$/, "$1")
		.replace(/\.+$/, "");

const parseIpv4Parts = (hostname: string): number[] | undefined => {
	const ipv4Match = hostname.match(/^(?<a>\d{1,3})\.(?<b>\d{1,3})\.(?<c>\d{1,3})\.(?<d>\d{1,3})$/);
	if (!ipv4Match?.groups) {
		return undefined;
	}

	return [ipv4Match.groups.a, ipv4Match.groups.b, ipv4Match.groups.c, ipv4Match.groups.d].map(
		(value) => Number.parseInt(value, 10),
	);
};

const isPrivateIpv4Parts = (parts: number[]): boolean => {
	if (parts.some((value) => Number.isNaN(value) || value > 255 || value < 0)) {
		return true;
	}

	const [a, b] = parts;
	if (a === 10 || a === 127 || a === 0) return true;
	if (a === 169 && b === 254) return true;
	if (a === 192 && b === 168) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	if (a === 100 && b >= 64 && b <= 127) return true;

	return false;
};

const isPrivateIpv4Hostname = (hostname: string): boolean => {
	const parts = parseIpv4Parts(hostname);
	return parts ? isPrivateIpv4Parts(parts) : false;
};

const parseIpv4MappedIpv6Parts = (hostname: string): number[] | undefined => {
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
};

const isPrivateIpv6Hostname = (hostname: string): boolean => {
	if (hostname === "::" || hostname === "::1" || hostname === "0:0:0:0:0:0:0:0") {
		return true;
	}

	if (hostname === "0:0:0:0:0:0:0:1" || hostname.startsWith("fe80:")) {
		return true;
	}

	const firstSegment = Number.parseInt(hostname.split(":")[0] || "", 16);
	if (!Number.isNaN(firstSegment) && firstSegment >= 0xfc00 && firstSegment <= 0xfdff) {
		return true;
	}

	const mappedIpv4Parts = parseIpv4MappedIpv6Parts(hostname);
	return mappedIpv4Parts ? isPrivateIpv4Parts(mappedIpv4Parts) : false;
};

export function isPrivateHostname(hostname: string): boolean {
	const normalized = normalizeHostname(hostname);
	if (!normalized) {
		return true;
	}

	if (
		normalized === "localhost" ||
		normalized.endsWith(".local") ||
		normalized.endsWith(".internal")
	) {
		return true;
	}

	if (normalized.includes(":")) {
		return isPrivateIpv6Hostname(normalized);
	}

	return isPrivateIpv4Hostname(normalized);
}

export function appendQueryParams(baseUrl: URL, params: Record<string, unknown> | undefined): void {
	if (!params) return;

	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null) {
			continue;
		}

		if (Array.isArray(value)) {
			for (const entry of value) {
				if (entry !== undefined && entry !== null) {
					baseUrl.searchParams.append(key, String(entry));
				}
			}
		} else {
			baseUrl.searchParams.set(key, String(value));
		}
	}
}
