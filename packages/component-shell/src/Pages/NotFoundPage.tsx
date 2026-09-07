import { ButtonLink, PageStatus, Pet } from "@ngriffin_uk/polychat-component-ui";
import { MODE_BASE_PATHS } from "@ngriffin_uk/polychat-library-react";

import { PageShell } from "../Shell/PageShell";
import { StandardSidebarContent } from "../Sidebar/StandardSidebarContent";

export function NotFoundPage() {
  return (
    <PageShell title="Page Not Found" sidebarContent={<StandardSidebarContent />}>
      <PageStatus
        icon={<Pet size={96} />}
        title="This page has flown off."
        message="Whatever perched here has moved on. Check the URL, or head back somewhere familiar."
        className="h-full"
      >
        <ButtonLink variant="outline" href={MODE_BASE_PATHS.chat}>
          Back to the nest
        </ButtonLink>
      </PageStatus>
    </PageShell>
  );
}
