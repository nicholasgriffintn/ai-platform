import { jsonSchemaToZod } from "../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "./types";

export const capture_screenshot: FunctionToolDescriptor = {
  name: "capture_screenshot",
  description:
    "Captures visual renderings of webpages or custom HTML content. Use when users need to visualize a webpage or when explaining web-based concepts.",
  strict: true,
  inputSchema: jsonSchemaToZod({
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
            description: "Removes the default white background when taking a screenshot",
          },
          fullPage: {
            type: "boolean",
            description: "Captures the full scrollable page instead of just the viewport",
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
        description: "Configures how and when the page is considered fully loaded",
        properties: {
          waitUntil: {
            type: "string",
            enum: ["load", "domcontentloaded", "networkidle0"],
            description: "Defines when the browser considers navigation complete",
          },
          timeout: {
            type: "integer",
            description: "Maximum wait time (in milliseconds) before navigation times out",
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
  }),
  type: "premium",
  permissions: ["read"],
};
