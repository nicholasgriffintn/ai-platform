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
          className="bg-surface border-border text-muted-foreground hover:border-border-strong hover:text-foreground rounded-full border px-3 py-1 text-xs font-medium no-underline transition-colors"
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
}
