const DEVICE_KEY = "polychat-device-id";
const LEGACY_NOTIFICATION_KEY = "polychat-notification-installation";

let cached: string | undefined;

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    return;
  }
}

export function getDeviceId(): string {
  if (cached) {
    return cached;
  }

  if (typeof window === "undefined") {
    return "";
  }

  const existing = readStorage(DEVICE_KEY) ?? readStorage(LEGACY_NOTIFICATION_KEY);

  if (existing) {
    cached = existing;
    writeStorage(DEVICE_KEY, existing);

    return existing;
  }

  const deviceId = crypto.randomUUID();

  cached = deviceId;
  writeStorage(DEVICE_KEY, deviceId);

  return deviceId;
}
