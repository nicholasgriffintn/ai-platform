import { Link } from "react-router";

import { Logo } from "~/components/Logo";
import { PageHeader } from "~/components/PageHeader";
import { PageShell } from "~/components/PageShell";
import { PageTitle } from "~/components/PageTitle";
import { APP_NAME } from "~/constants";

export function meta() {
  return {
    title: "Error - Polychat",
    description: "An error occurred while loading the page",
  };
}

const ErrorHeader = () => (
  <div className="sticky top-0 bg-off-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 z-10 w-full">
    <div className="m-2 flex items-center justify-between max-w-full">
      <div className="flex items-center min-w-0">
        <div className="w-10 h-10">
          <Logo />
        </div>
        <div className="flex-1 overflow-auto w-full">
          <div className="text-base font-semibold text-zinc-600 dark:text-zinc-200 ml-2 truncate">
            <Link
              to="/"
              className="hover:text-zinc-700 dark:hover:text-zinc-300 no-underline"
            >
              {APP_NAME}
            </Link>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default function ErrorRoute({
  message,
  details,
  stack,
}: {
  message: string;
  details: string;
  stack: string;
}) {
  return (
    <PageShell
      headerContent={
        <>
          <ErrorHeader />
          <PageHeader>
            <PageTitle title={message} />
          </PageHeader>
        </>
      }
      className="flex h-dvh w-full max-w-full overflow-hidden bg-off-white dark:bg-zinc-900"
    >
      <div className="flex-1 overflow-auto w-full">
        <div className="text-base font-semibold text-zinc-600 dark:text-zinc-200 ml-2 truncate">
          {message}
        </div>
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          {details}
        </div>
        <div className="text-sm text-zinc-500 dark:text-zinc-400">{stack}</div>
      </div>
    </PageShell>
  );
}
