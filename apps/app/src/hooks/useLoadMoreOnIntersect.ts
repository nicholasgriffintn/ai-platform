import { useEffect, useRef } from "react";

export function useLoadMoreOnIntersect({
	enabled,
	isLoading,
	onLoadMore,
	rootMargin = "160px",
}: {
	enabled: boolean;
	isLoading: boolean;
	onLoadMore: () => void;
	rootMargin?: string;
}) {
	const sentinelRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const sentinel = sentinelRef.current;
		if (!sentinel || !enabled) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting && !isLoading) {
					onLoadMore();
				}
			},
			{ rootMargin },
		);

		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [enabled, isLoading, onLoadMore, rootMargin]);

	return sentinelRef;
}
