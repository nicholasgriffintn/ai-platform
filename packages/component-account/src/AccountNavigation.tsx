import type { ReactNode } from "react";

export interface AccountSection {
  id: string;
  label: string;
  disabledReason?: string;
  icon?: ReactNode;
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
    <nav aria-label={ariaLabel}>
      <ul className="polychat-account-navigation">
        {sections.map((section) => (
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
    </nav>
  );
}
