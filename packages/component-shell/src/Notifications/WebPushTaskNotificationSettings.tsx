import { TaskNotificationSettings } from "../Work/TaskNotificationSettings.js";
import { useWebPushTaskNotificationChannel } from "./useWebPushTaskNotificationChannel.js";

export function WebPushTaskNotificationSettings() {
  return <TaskNotificationSettings channel={useWebPushTaskNotificationChannel()} />;
}
