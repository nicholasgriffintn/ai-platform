export interface CategorizedItems<T> {
	today: T[];
	yesterday: T[];
	thisWeek: T[];
	thisMonth: T[];
	lastMonth: T[];
	older: T[];
}

/**
 * Generic function to categorize items by date into common time periods
 * @param items - Array of items to categorize
 * @param getDate - Function to extract a Date from each item
 * @returns Object with items categorized by time period
 */
export function categorizeItemsByDate<T>(
	items: T[] = [],
	getDate: (item: T) => Date,
): CategorizedItems<T> {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const oneDay = 24 * 60 * 60 * 1000;
	const oneWeek = 7 * oneDay;
	const oneMonth = 30 * oneDay;
	const twoMonths = 60 * oneDay;

	const startOfWeek = new Date(today.getTime() - oneWeek);
	const startOfMonth = new Date(today.getTime() - oneMonth);
	const startOfLastMonth = new Date(today.getTime() - twoMonths);

	const tomorrow = new Date(today);
	tomorrow.setDate(tomorrow.getDate() + 1);

	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);

	return {
		today: items.filter((item) => {
			const date = getDate(item);
			return date >= today && date < tomorrow;
		}),
		yesterday: items.filter((item) => {
			const date = getDate(item);
			return date >= yesterday && date < today;
		}),
		thisWeek: items.filter((item) => {
			const date = getDate(item);
			return date >= startOfWeek && date < yesterday;
		}),
		thisMonth: items.filter((item) => {
			const date = getDate(item);
			return date >= startOfMonth && date < startOfWeek;
		}),
		lastMonth: items.filter((item) => {
			const date = getDate(item);
			return date >= startOfLastMonth && date < startOfMonth;
		}),
		older: items.filter((item) => {
			const date = getDate(item);
			return date < startOfLastMonth;
		}),
	};
}
