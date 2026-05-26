import { isRecord } from "./objects";

export type OptionBag = Record<string, unknown>;

export function readOptionBag(value: unknown): OptionBag {
	return isRecord(value) ? value : {};
}

function readOption<T = unknown>(options: OptionBag | undefined, key: string): T | undefined {
	return options?.[key] as T | undefined;
}

export function readRecordOption(options: OptionBag | undefined, key: string): Record<string, any> {
	const value = readOption(options, key);
	return isRecord(value) ? value : {};
}
