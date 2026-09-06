export function NotificationBar({ title, description }: { title: string; description: string }) {
  return (
    <div
      className="border-l-4 border-active-work bg-active-work/8 p-4 text-foreground"
      role="alert"
      aria-labelledby="notification-bar-title"
      aria-describedby="notification-bar-description"
    >
      <p id="notification-bar-title" className="font-bold text-foreground">
        {title}
      </p>
      <p id="notification-bar-description">{description}</p>
    </div>
  );
}
