import { Loader2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router";

import { ResponseRenderer } from "~/components/Apps/ResponseRenderer";
import { getIcon } from "~/components/Apps/utils";
import { BackLink } from "~/components/Core/BackLink";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { PageStatus } from "~/components/Core/PageStatus";
import { useDynamicApp, useDynamicAppResponse } from "~/hooks/useDynamicApps";

export function meta({ params }: { params: { responseId: string } }) {
  return [
    { title: `App Response ${params.responseId} - Polychat` },
    {
      name: "description",
      content: "Saved dynamic app response on Polychat",
    },
  ];
}

export default function DynamicAppResponsePage() {
  const { responseId } = useParams<{ responseId: string }>();
  const navigate = useNavigate();

  const {
    data: responseItem,
    isLoading: responseLoading,
    error: responseError,
  } = useDynamicAppResponse(responseId || null);

  const appId = responseItem?.app_id || null;
  const {
    data: appSchema,
    isLoading: appLoading,
    error: appError,
  } = useDynamicApp(appId);

  const parsedData = useMemo(() => {
    if (!responseItem) return null;
    try {
      return JSON.parse(responseItem.data);
    } catch (e) {
      console.error("Failed to parse response data", e);
      return null;
    }
  }, [responseItem]);

  const error = responseError || appError;
  const isLoading = responseLoading || (appId && appLoading);

  useEffect(() => {
    if (responseItem && !appId) {
      navigate("/apps");
    }
  }, [responseItem, appId, navigate]);

  if (isLoading) {
    return (
      <PageShell
        className="flex h-screen w-full items-center justify-center bg-off-white dark:bg-zinc-900"
        displayNavBar={false}
      >
        <div className="flex flex-col items-center">
          <Loader2 size={48} className="animate-spin text-blue-500 mb-4" />
          <p className="text-zinc-600 dark:text-zinc-400">
            Loading response...
          </p>
        </div>
      </PageShell>
    );
  }

  if (error || !parsedData) {
    return (
      <PageShell
        title="Response Not Available"
        className="bg-off-white dark:bg-zinc-900"
        displayNavBar={false}
      >
        <PageStatus message={error ? String(error) : "Response not found"} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={
        appSchema ? `${appSchema.name} - Response` : "Dynamic App Response"
      }
      className="bg-off-white dark:bg-zinc-900"
      isBeta={true}
      headerContent={
        <PageHeader>
          <BackLink to="/apps" label="Back to Apps" />
        </PageHeader>
      }
    >
      <div className="container mx-auto px-4 max-w-4xl py-4 space-y-8">
        {appSchema && (
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-off-white dark:bg-zinc-700 shadow-sm">
              {getIcon(appSchema.icon)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {appSchema.name}
              </h1>
              {parsedData?.result?.timestamp && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Generated on:{" "}
                  {new Date(parsedData.result.timestamp).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        )}

        {parsedData?.formData && (
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 bg-white dark:bg-zinc-800">
            <h2 className="text-lg font-semibold mb-3 text-zinc-800 dark:text-zinc-200">
              Input Details
            </h2>
            <dl className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {Object.entries(parsedData.formData).map(([key, value]) => (
                <div
                  key={key}
                  className="py-2 grid grid-cols-3 gap-4 text-sm text-zinc-700 dark:text-zinc-300"
                >
                  <dt className="font-medium col-span-1">{key}</dt>
                  <dd className="col-span-2 break-words">
                    {typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <ResponseRenderer
          app={appSchema}
          result={parsedData}
          responseType={appSchema?.responseSchema.type}
        />
      </div>
    </PageShell>
  );
}
