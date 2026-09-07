import { TaskNotificationSettings } from "../Work/TaskNotificationSettings.js";
import { useDeviceTaskNotificationChannel } from "./useDeviceTaskNotificationChannel.js";

export function DeviceTaskNotificationSettings() {
  return <TaskNotificationSettings channel={useDeviceTaskNotificationChannel()} />;
}
