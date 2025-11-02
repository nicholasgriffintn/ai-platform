import type { ReactNode } from "react";

interface LayoutProps {
	children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
	return (
		<div className="min-h-screen">
			<div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
				{children}
			</div>
		</div>
	);
}
