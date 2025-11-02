export const formatDate = (dateString: string) => {
	if (!dateString) return "N/A";
	return new Date(dateString).toLocaleDateString(undefined, {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
};

export function formatRelativeTime(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();

	const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	const months = Math.floor(days / 30);
	const years = Math.floor(days / 365);

	if (years > 0) {
		return `${years} ${years === 1 ? "year" : "years"} ago`;
	}
	if (months > 0) {
		return `${months} ${months === 1 ? "month" : "months"} ago`;
	}
	if (days > 0) {
		return `${days} ${days === 1 ? "day" : "days"} ago`;
	}
	if (hours > 0) {
		return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
	}
	if (minutes > 0) {
		return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
	}
	return "just now";
}
