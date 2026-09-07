export interface TaskNotificationChannel {
  status: string;
  isDeliverable: boolean;
  isUnavailable: boolean;
  error: string | null;
  isBusy: boolean;
  enable: () => Promise<unknown>;
  disable: () => Promise<unknown>;
  retry: (() => Promise<unknown>) | null;
}

export type UseTaskNotificationChannel = () => TaskNotificationChannel;
