export function appendUrlPath(baseUrl: string, path: string): string {
	return new URL(path.replace(/^\/+/, ""), `${baseUrl.replace(/\/+$/, "")}/`).toString();
}
