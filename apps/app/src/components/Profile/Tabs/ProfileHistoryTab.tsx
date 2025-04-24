import { Construction } from "lucide-react";
import { PageHeader } from "~/components/PageHeader";
import { PageTitle } from "~/components/PageTitle";
import { Alert, AlertDescription, AlertTitle } from "../../ui";

export function ProfileHistoryTab() {
  return (
    <div>
      <PageHeader>
        <PageTitle title="Chat History" />
      </PageHeader>

      <div>
        <div className="text-zinc-500 dark:text-zinc-400">
          <Alert variant="info">
            <Construction className="h-4 w-4 mr-2" />
            <AlertTitle>Coming soon</AlertTitle>
            <AlertDescription>This feature is coming soon.</AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
