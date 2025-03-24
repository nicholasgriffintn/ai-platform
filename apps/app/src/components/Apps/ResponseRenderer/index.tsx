import { Button } from "~/components/ui";
import type { AppSchema } from "~/lib/api/dynamic-apps";
import { getCardGradient, styles } from "../utils";
import { CustomView } from "./CustomView";
import { JsonView } from "./JsonView";
import { TableView } from "./TableView";
import { TemplateView } from "./TemplateView";
import { TextView } from "./TextView";

interface ResponseRendererProps {
  app?: AppSchema;
  result: Record<string, any>;
  onReset?: () => void;
  responseType?: string;
  responseDisplay?: {
    fields?: {
      key: string;
      label: string;
    }[];
    template?: string;
  };
  className?: string;
  embedded?: boolean;
  onToolInteraction?: (
    toolName: string,
    action: "useAsPrompt",
    data: Record<string, any>,
  ) => void;
}

export const ResponseRenderer = ({
  app,
  result,
  onReset,
  responseType,
  responseDisplay,
  className = "",
  embedded = false,
  onToolInteraction,
}: ResponseRendererProps) => {
  const renderResponse = () => {
    const type = responseType || app?.responseSchema.type;
    const resultData = result.data || result;

    let responseData;
    if (app && resultData?.result) {
      responseData = resultData.result;
    } else if (responseType && "result" in resultData) {
      responseData = resultData.result;
    } else if (responseType && "results" in resultData) {
      responseData = resultData.results;
    } else {
      responseData = resultData;
    }

    const display = responseDisplay || app?.responseSchema.display;

    if (!type) {
      return (
        <CustomView
          data={responseData}
          embedded={embedded}
          onToolInteraction={onToolInteraction}
        />
      );
    }

    switch (type) {
      case "table":
        if (responseDisplay?.fields && Array.isArray(responseData)) {
          const tableData = {
            headers: responseDisplay.fields,
            rows: responseData,
          };
          return <TableView data={tableData} />;
        }
        return <TableView data={responseData} />;

      case "json":
        return <JsonView data={responseData} />;

      case "text":
        if (typeof responseData === "string") {
          return <TextView data={{ content: responseData }} />;
        }
        return <TextView data={responseData} />;

      case "template":
        return (
          <TemplateView template={display?.template} data={responseData} />
        );

      default:
        return (
          <CustomView
            data={responseData}
            embedded={embedded}
            onToolInteraction={onToolInteraction}
          />
        );
    }
  };

  if (app && onReset) {
    return (
      <div className="max-w-3xl mx-auto">
        <div
          className={`${styles.card} bg-gradient-to-br ${getCardGradient(app.icon)} mb-6`}
        >
          <div className="mb-6">
            <div className="flex items-center space-x-4 mb-4">
              <div className={styles.iconContainer}>
                {styles.getIcon(app.icon)}
              </div>
              <div>
                <h1 className={styles.heading}>{app.name} - Results</h1>
                <p className={styles.paragraph}>
                  {result.data?.message || `Results for ${app.name}`}
                </p>
                {result.data?.timestamp && (
                  <p className={`${styles.smallText} mt-1`}>
                    Generated on:{" "}
                    {new Date(result.data.timestamp).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-off-white/80 dark:bg-zinc-800/80 p-5 rounded-lg">
            {renderResponse()}
          </div>

          <div className="flex justify-between mt-6">
            <Button variant="secondary" onClick={onReset}>
              Start Over
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <div className={className}>{renderResponse()}</div>;
};
