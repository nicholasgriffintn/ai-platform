export function formatProviderLabel(provider: string) {
	return provider
		.split(/[-_]/g)
		.filter(Boolean)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(" ");
}
