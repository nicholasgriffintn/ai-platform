import type { ReactNode } from "react";

export function StorySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="polychat-eyebrow">{title}</h2>
      {children}
    </section>
  );
}
