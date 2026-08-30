import { ButtonLink, PageStatus } from "@ngriffin_uk/polychat-component-ui";

import { Logo } from "~/components/Core/Logo";
import { PageShell } from "~/components/Core/PageShell";
import { StandardSidebarContent } from "~/components/Sidebar/StandardSidebarContent";

export function meta() {
  return [{ title: "404 - Page Not Found" }, { name: "description", content: "Page not found" }];
}

export default function CatchAllRoute() {
  return (
    <PageShell title="Page Not Found" sidebarContent={<StandardSidebarContent />}>
      <PageStatus
        icon={
          <div className="h-24 w-24 animate-bob motion-reduce:animate-none">
            <Logo variant="logo_minimalist" />
          </div>
        }
        title="This page has flown off."
        message="Whatever perched here has moved on. Check the URL, or head back somewhere familiar."
        className="h-full"
      >
        <ButtonLink variant="outline" href="/">
          Back to the nest
        </ButtonLink>
      </PageStatus>
    </PageShell>
  );
}
