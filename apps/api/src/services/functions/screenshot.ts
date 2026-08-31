import { captureScreenshot } from "~/services/apps/retrieval/screenshot";

import type { ApiToolDefinition } from "../../types/functions";
import { capture_screenshot as capture_screenshotDescriptor } from "./definitions/screenshot";

const DEFAULT_VIEWPORT = {
  width: 1740,
  height: 1008,
};

const DEFAULT_SCREENSHOT_OPTIONS = {
  fullPage: true,
};

const DEFAULT_GOTO_OPTIONS = {
  waitUntil: "networkidle0" as const,
};

export const capture_screenshot: ApiToolDefinition = {
  ...capture_screenshotDescriptor,
  execute: async (args, context) => {
    const req = context.request;

    const addScriptTag = args.addScriptTag ? [{ content: args.addScriptTag }] : undefined;
    const addStyleTag = args.addStyleTag ? [{ content: args.addStyleTag }] : undefined;

    const viewport = args.viewport || DEFAULT_VIEWPORT;
    const screenshotOptions = args.screenshotOptions || DEFAULT_SCREENSHOT_OPTIONS;
    const gotoOptions = args.gotoOptions || DEFAULT_GOTO_OPTIONS;

    const result = await captureScreenshot(
      {
        url: args.url,
        html: args.html,
        screenshotOptions,
        viewport,
        gotoOptions,
        addScriptTag,
        addStyleTag,
      },
      req,
    );

    if (result.status === "error") {
      return {
        status: "error",
        name: "capture_screenshot",
        content: result.error || "Unknown error occurred",
        data: {},
      };
    }

    return {
      status: "success",
      name: "capture_screenshot",
      content: `Screenshot captured: [View Screenshot](${result.data?.screenshotUrl})`,
      data: result.data,
    };
  },
};
