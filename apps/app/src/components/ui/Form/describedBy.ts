export function mergeDescribedBy(...ids: Array<string | undefined>): string | undefined {
	const uniqueIds = ids
		.flatMap((id) => id?.split(/\s+/) ?? [])
		.filter((id, index, allIds) => id && allIds.indexOf(id) === index);

	return uniqueIds.length > 0 ? uniqueIds.join(" ") : undefined;
}
