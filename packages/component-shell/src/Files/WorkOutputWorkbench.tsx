import { WorkOutputView } from "@ngriffin_uk/polychat-component-content";
import { Button } from "@ngriffin_uk/polychat-component-ui";
import { useExportOutput } from "@ngriffin_uk/polychat-library-react";
import { DECK_OUTPUT_KIND, type Output } from "@ngriffin_uk/polychat-schemas";
import { downloadBlob } from "@ngriffin_uk/polychat-utility-react";
import { Download } from "lucide-react";

export function WorkOutputWorkbench({ output }: { output: Output }) {
  const exportOutput = useExportOutput();
  const format = output.kind === DECK_OUTPUT_KIND ? "Markdown" : "CSV";

  const download = async () => {
    const exported = await exportOutput.mutateAsync({ outputId: output.id });

    downloadBlob(exported.filename ?? output.title, exported.blob);
  };

  return (
    <div className="flex flex-col gap-3">
      <WorkOutputView kind={output.kind} content={output.content} />
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          icon={<Download className="size-4" />}
          isLoading={exportOutput.isPending}
          onClick={() => void download()}
        >
          Download {format}
        </Button>
        {exportOutput.error ? (
          <p role="alert" className="text-sm text-failure">
            {exportOutput.error.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
