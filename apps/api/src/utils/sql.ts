export function escapeSqlLikePattern(value: string): string {
	return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
