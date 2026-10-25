import { convertFileSrc } from "@tauri-apps/api/core";

const DESKTOP_MEDIA_SCHEME = "polychat-media";

export const DESKTOP_MEDIA_BASE_URL = convertFileSrc("", DESKTOP_MEDIA_SCHEME).replace(/\/$/, "");
