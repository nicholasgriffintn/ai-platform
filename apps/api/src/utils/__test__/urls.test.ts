import { describe, expect, it } from "vitest";

import { appendQueryParams, appendUrlPath, isPrivateHostname } from "../urls";

describe("url utilities", () => {
	it("appends URL paths without duplicate slashes", () => {
		expect(appendUrlPath("https://example.com/base/", "/v1/chat")).toBe(
			"https://example.com/base/v1/chat",
		);
	});

	it("appends query params and skips nullish values", () => {
		const url = new URL("https://example.com/search?existing=true");

		appendQueryParams(url, {
			empty: "",
			page: 2,
			q: "test",
			skipNull: null,
			skipUndefined: undefined,
			tag: ["a", null, "b", undefined],
		});

		expect(url.toString()).toBe(
			"https://example.com/search?existing=true&empty=&page=2&q=test&tag=a&tag=b",
		);
	});

	it("detects private and local hostnames", () => {
		expect(isPrivateHostname("localhost")).toBe(true);
		expect(isPrivateHostname("localhost.")).toBe(true);
		expect(isPrivateHostname("service.internal")).toBe(true);
		expect(isPrivateHostname("printer.local")).toBe(true);
		expect(isPrivateHostname("10.0.0.1")).toBe(true);
		expect(isPrivateHostname("172.16.0.1")).toBe(true);
		expect(isPrivateHostname("192.168.1.10")).toBe(true);
		expect(isPrivateHostname("169.254.1.1")).toBe(true);
		expect(isPrivateHostname("100.64.0.1")).toBe(true);
		expect(isPrivateHostname("[::1]")).toBe(true);
		expect(isPrivateHostname("[fe80::1]")).toBe(true);
		expect(isPrivateHostname("[fd00::1]")).toBe(true);
		expect(isPrivateHostname("[::ffff:7f00:1]")).toBe(true);
	});

	it("allows public hostnames", () => {
		expect(isPrivateHostname("example.com")).toBe(false);
		expect(isPrivateHostname("8.8.8.8")).toBe(false);
		expect(isPrivateHostname("[2001:4860:4860::8888]")).toBe(false);
	});
});
