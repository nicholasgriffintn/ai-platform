export interface SectionNavItem {
  id: string;
  label: string;
}

export interface SectionNavProps {
  label: string;
  sections: readonly SectionNavItem[];
}

export function SectionNav({ label, sections }: SectionNavProps) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground no-underline transition-colors hover:border-border-strong hover:text-foreground"
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
}
