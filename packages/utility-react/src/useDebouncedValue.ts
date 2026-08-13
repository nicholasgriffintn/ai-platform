import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs: number): T {
	const [debouncedValue, setDebouncedValue] = useState(value);

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedValue(value), delayMs);
		return () => clearTimeout(timer);
	}, [delayMs, value]);

	return debouncedValue;
}
