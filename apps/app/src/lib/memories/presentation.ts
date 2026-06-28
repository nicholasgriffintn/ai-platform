export function getMemoryCategoryClassName(category: string | null | undefined): string {
	switch (category) {
		case "fact":
			return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
		case "preference":
			return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
		case "schedule":
			return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
		default:
			return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
	}
}

export function formatMemoryDate(value: string | null | undefined): string | undefined {
	return value ? new Date(value).toLocaleDateString() : undefined;
}
