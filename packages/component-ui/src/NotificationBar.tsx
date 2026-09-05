export function NotificationBar({ title, description }: { title: string; description: string }) {
  return (
    <div
      className="border-active-work bg-active-work/8 text-foreground border-l-4 p-4"
      role="alert"
      aria-labelledby="notification-bar-title"
      aria-describedby="notification-bar-description"
    >
      <p id="notification-bar-title" className="text-foreground font-bold">
        {title}
      </p>
      <p id="notification-bar-description">{description}</p>
    </div>
  );
}
