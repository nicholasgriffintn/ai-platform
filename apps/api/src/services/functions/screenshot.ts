import { captureScreenshot } from "~/services/apps/screenshot";
import type { IFunction, IRequest } from "~/types";

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

export const capture_screenshot: IFunction = {
  name: "capture_screenshot",
  description:
    "Captures visual renderings of webpages or custom HTML content. Use when users need to visualize a webpage or when explaining web-based concepts.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The webpage URL to take a screenshot of",
      },
      screenshotOptions: {
        type: "object",
        description: "Configures the screenshot format and quality",
        properties: {
          omitBackground: {
            type: "boolean",
            description:
              "Removes the default white background when taking a screenshot",
          },
          fullPage: {
            type: "boolean",
            description:
              "Captures the full scrollable page instead of just the viewport",
          },
        },
      },
      viewport: {
        type: "object",
        description: "Sets the browser viewport dimensions for rendering",
        properties: {
          width: {
            type: "integer",
            description: "Viewport width in pixels",
          },
          height: {
            type: "integer",
            description: "Viewport height in pixels",
          },
        },
      },
      gotoOptions: {
        type: "object",
        description:
          "Configures how and when the page is considered fully loaded",
        properties: {
          waitUntil: {
            type: "string",
            enum: ["load", "domcontentloaded", "networkidle0"],
            description:
              "Defines when the browser considers navigation complete",
          },
          timeout: {
            type: "integer",
            description:
              "Maximum wait time (in milliseconds) before navigation times out",
          },
        },
      },
      addScriptTag: {
        type: "string",
        description: "JavaScript code to inject before taking a screenshot",
      },
      addStyleTag: {
        type: "string",
        description: "CSS styles to inject before rendering",
      },
    },
    required: ["url"],
  },
  type: "normal",
  costPerCall: 1,
  function: async (
    completion_id: string,
    args: any,
    req: IRequest,
    app_url?: string,
  ) => {
    const addScriptTag = args.addScriptTag
      ? [{ content: args.addScriptTag }]
      : undefined;
    const addStyleTag = args.addStyleTag
      ? [{ content: args.addStyleTag }]
      : undefined;

    const viewport = args.viewport || DEFAULT_VIEWPORT;
    const screenshotOptions =
      args.screenshotOptions || DEFAULT_SCREENSHOT_OPTIONS;
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
