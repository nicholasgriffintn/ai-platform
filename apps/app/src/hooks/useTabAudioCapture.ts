import { useCallback, useState } from "react";
import { toast } from "sonner";

export interface TabInfo {
	url?: string;
	title?: string;
	timestamp: string;
}

export interface TabAudioCapture {
	start: () => Promise<MediaStream | null>;
	stop: () => void;
	isCapturing: boolean;
	tabInfo: TabInfo | null;
}

export function useTabAudioCapture(): TabAudioCapture {
	const [stream, setStream] = useState<MediaStream | null>(null);
	const [tabInfo, setTabInfo] = useState<TabInfo | null>(null);

	const stop = useCallback(() => {
		if (stream) {
			stream.getTracks().forEach((t) => t.stop());
			setStream(null);
			setTabInfo(null);
		}
	}, [stream]);

	const start = useCallback(async (): Promise<MediaStream | null> => {
		try {
			if (!navigator.mediaDevices?.getDisplayMedia) {
				toast.error("Tab audio capture is not supported in this browser");
				return null;
			}

			const media = await navigator.mediaDevices.getDisplayMedia({
				video: true,
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					channelCount: 1,
				},
			});

			media.getVideoTracks().forEach((t) => t.stop());

			const videoTrack = media.getVideoTracks()[0];
			const tabUrl = "";
			let tabTitle = "";

			if (videoTrack) {
				const settings = videoTrack.getSettings();
				if (settings.displaySurface === "browser") {
					tabTitle = "Browser Tab";
				} else if (settings.displaySurface === "window") {
					tabTitle = "Application Window";
				} else if (settings.displaySurface === "monitor") {
					tabTitle = "Screen Capture";
				}
			}

			setTabInfo({
				url: tabUrl || undefined,
				title: tabTitle || "Captured Content",
				timestamp: new Date().toISOString(),
			});

			setStream(media);
			return media;
		} catch (err) {
			if (err instanceof DOMException && err.name === "NotAllowedError") {
				toast.warning("Tab capture permission denied");
			} else {
				console.error("Failed to start tab audio capture", err);
				toast.error("Failed to start tab audio capture");
			}
			return null;
		}
	}, []);

	return { start, stop, isCapturing: !!stream, tabInfo };
}
