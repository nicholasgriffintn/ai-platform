import type { ReactNode } from "react";

export function StorySection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section data-stagger aria-label={title} className="flex min-w-0 flex-col gap-3">
      <div className="flex min-h-6 items-center gap-2">
        <h3 className="polychat-eyebrow flex-1">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
