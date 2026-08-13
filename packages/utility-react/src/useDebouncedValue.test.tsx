import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useDebouncedValue } from "./useDebouncedValue";

describe("useDebouncedValue", () => {
	it("publishes only the latest value after the delay", () => {
		vi.useFakeTimers();
		const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 100), {
			initialProps: { value: "first" },
		});

		rerender({ value: "second" });
		rerender({ value: "third" });
		expect(result.current).toBe("first");

		act(() => vi.advanceTimersByTime(100));
		expect(result.current).toBe("third");
		vi.useRealTimers();
	});
});
