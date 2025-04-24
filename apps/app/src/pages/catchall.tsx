import { StandardSidebarContent } from "~/components/StandardSidebarContent";
import { SidebarLayout } from "~/layouts/SidebarLayout";
import { PageHeader } from "../components/PageHeader";
import { PageTitle } from "../components/PageTitle";

export function meta() {
  return [
    { title: "404 - Page Not Found" },
    { name: "description", content: "Page not found" },
  ];
}

export default function CatchAllRoute() {
  return (
    <SidebarLayout sidebarContent={<StandardSidebarContent />}>
      <div className="flex flex-col items-center justify-center h-full">
        <PageHeader>
          <PageTitle title="Page Not Found" />
        </PageHeader>
        <p className="text-zinc-500 dark:text-zinc-400">Page not found</p>
      </div>
    </SidebarLayout>
  );
}
