import type { ReactNode } from "react";

import { cn } from "../utils";

interface PageStatusProps {
  icon?: ReactNode;
  title?: string;
  message?: string;
  children?: ReactNode;
  className?: string;
}

export const PageStatus = ({ icon, title, message, children, className }: PageStatusProps) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 p-4 text-center",
        "h-[calc(100vh-10rem)]",
        className,
      )}
    >
      {icon && <div className="text-muted-foreground">{icon}</div>}
      {title && <h2 className="text-lg font-semibold text-foreground">{title}</h2>}
      {message && <p className="max-w-md text-sm text-muted-foreground">{message}</p>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
};
