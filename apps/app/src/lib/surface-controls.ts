import {
	createMemorySurfaceStorage,
	createSurfaceAction,
	createUnavailableSurfaceAction,
	type SurfaceControls,
	type SurfaceStorage,
} from "@ngriffin_uk/polychat-library-surface";
import {
	requireExternalHttpUrl,
	requireInternalNavigationPath,
} from "@ngriffin_uk/polychat-schemas";
import { toast } from "sonner";

export type WebNavigationIntent = { href: string; replace?: boolean };

const hasBrowserWindow = typeof window !== "undefined";
const hasClipboard = typeof navigator !== "undefined" && Boolean(navigator.clipboard);
const webStorage: SurfaceStorage = hasBrowserWindow
	? {
			get: async (key) => window.localStorage.getItem(key),
			set: async (key, value) => window.localStorage.setItem(key, value),
			remove: async (key) => window.localStorage.removeItem(key),
		}
	: createMemorySurfaceStorage();

export const webSurfaceControls: SurfaceControls<WebNavigationIntent, File> = {
	navigate: hasBrowserWindow
		? createSurfaceAction(({ href, replace }) => {
				const path = requireInternalNavigationPath(href);
				if (replace) window.location.replace(path);
				else window.location.assign(path);
			})
		: createUnavailableSurfaceAction("navigation", "Navigation requires a browser window"),
	openExternal: hasBrowserWindow
		? createSurfaceAction((url) => {
				window.open(requireExternalHttpUrl(url), "_blank", "noopener,noreferrer");
			})
		: createUnavailableSurfaceAction("external links", "External links require a browser window"),
	copyText: hasClipboard
		? createSurfaceAction((text) => navigator.clipboard.writeText(text))
		: createUnavailableSurfaceAction("clipboard", "Clipboard access is not supported by this host"),
	share:
		typeof navigator !== "undefined" && typeof navigator.share === "function"
			? createSurfaceAction((request) => navigator.share(request))
			: createUnavailableSurfaceAction("share", "Sharing is not supported by this browser"),
	selectFiles: createUnavailableSurfaceAction(
		"file selection",
		"Use a controlled file input in the web renderer",
	),
	notify: hasBrowserWindow
		? createSurfaceAction(({ kind, message }) => {
				toast[kind](message);
			})
		: createUnavailableSurfaceAction("notifications", "Notifications require a browser window"),
	storage: webStorage,
};
