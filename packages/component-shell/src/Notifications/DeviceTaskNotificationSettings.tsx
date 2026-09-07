import { TaskNotificationSettings } from "../Work/TaskNotificationSettings";
import { useDeviceTaskNotificationChannel } from "./useDeviceTaskNotificationChannel";

export function DeviceTaskNotificationSettings() {
  return <TaskNotificationSettings channel={useDeviceTaskNotificationChannel()} />;
}
