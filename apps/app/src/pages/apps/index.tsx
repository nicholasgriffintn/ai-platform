import { Suspense, lazy } from "react";
import { PageShell } from "~/components/Core/PageShell";
import { LoadingSpinner } from "~/components/LoadingSpinner";

// Lazy load the DynamicApps component
const DynamicApps = lazy(() => 
  import("~/components/Apps").then(module => ({ default: module.DynamicApps }))
);

export function meta() {
  return {
    title: "Apps",
    description: "Explore and run dynamic applications",
  };
}

export default function AppsPage() {
  return (
    <PageShell title="Apps" fullBleed>
      <Suspense 
        fallback={
          <div className="flex items-center justify-center min-h-96">
            <LoadingSpinner message="Loading apps..." />
          </div>
        }
      >
        <DynamicApps />
      </Suspense>
    </PageShell>
  );
}
