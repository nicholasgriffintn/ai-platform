import type { ReactNode } from "react";

export interface AccountSection {
  id: string;
  label: string;
  group?: string;
  disabledReason?: string;
  icon?: ReactNode;
}

function groupSections(sections: AccountSection[]): Array<[string | undefined, AccountSection[]]> {
  const groups: Array<[string | undefined, AccountSection[]]> = [];

  for (const section of sections) {
    const current = groups[groups.length - 1];

    if (current && current[0] === section.group) {
      current[1].push(section);
    } else {
      groups.push([section.group, [section]]);
    }
  }

  return groups;
}

export interface AccountNavigationProps {
  sections: AccountSection[];
  activeSectionId: string;
  ariaLabel?: string;
  onSelect: (section: AccountSection) => void;
}

export function AccountNavigation({
  sections,
  activeSectionId,
  ariaLabel = "Account settings",
  onSelect,
}: AccountNavigationProps) {
  return (
    <nav aria-label={ariaLabel} className="space-y-4">
      {groupSections(sections).map(([group, groupedSections], index) => (
        <div key={group ?? `group-${index}`}>
          {group ? (
            <p className="text-muted-foreground px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.2em]">
              {group}
            </p>
          ) : null}
          <ul className="polychat-account-navigation">
            {groupedSections.map((section) => (
              <li key={section.id}>
                <button
                  type="button"
                  aria-current={section.id === activeSectionId ? "page" : undefined}
                  disabled={Boolean(section.disabledReason)}
                  title={section.disabledReason}
                  onClick={() => onSelect(section)}
                >
                  {section.icon}
                  {section.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
