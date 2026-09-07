import { TaskNotificationSettings } from "../Work/TaskNotificationSettings";
import { useWebPushTaskNotificationChannel } from "./useWebPushTaskNotificationChannel";

export function WebPushTaskNotificationSettings() {
  return <TaskNotificationSettings channel={useWebPushTaskNotificationChannel()} />;
}
