import {
  browserApprovalResponseSchema,
  type BrowserApprovalResponse,
} from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { browserTestApproval } from "../../../../test/fixtures/computer-use";
import { validateBrowserApprovalResponse } from "./approvals";

const response: BrowserApprovalResponse = {
  type: "browser_authentication",
  action: "submit",
  selected_option: "password",
  fields: [
    { field_id: "email", value: "tester@example.test" },
    { field_id: "password", value: "sensitive-test-value" },
  ],
};

describe("browser sign-in validation", () => {
  it("accepts exactly the selected method's fields", () => {
    expect(() => validateBrowserApprovalResponse(browserTestApproval, response)).not.toThrow();
  });
  it.each([
    { ...response, fields: [{ field_id: "email", value: "tester@example.test" }] },
    { ...response, fields: [...response.fields, { field_id: "code", value: "123456" }] },
    { ...response, fields: [...response.fields, response.fields[0]] },
    { ...response, selected_option: "missing" },
  ])("rejects incomplete, unrelated, duplicated, or unknown input", (invalid) => {
    expect(() => validateBrowserApprovalResponse(browserTestApproval, invalid)).toThrow(
      "Response does not match",
    );
  });
  it.each([null, "http://example.test", "https://user:password@example.test", "invalid"])(
    "blocks credentials for an unverified destination %s",
    (credential_origin) => {
      if (browserTestApproval.request.type !== "browser_authentication") {
        throw new Error("Unexpected fixture");
      }

      const approval = {
        ...browserTestApproval,
        request: { ...browserTestApproval.request, credential_origin },
      };

      expect(() => validateBrowserApprovalResponse(approval, response)).toThrow();
      expect(() =>
        validateBrowserApprovalResponse(approval, {
          type: "browser_authentication",
          action: "cancel",
        }),
      ).not.toThrow();
    },
  );
  it("accepts choosing a login method without entering fields", () => {
    if (browserTestApproval.request.type !== "browser_authentication") {
      throw new Error("Unexpected fixture");
    }

    const approval = {
      ...browserTestApproval,
      request: {
        ...browserTestApproval.request,
        fields: [],
        options: [{ id: "email-code", label: "Email a code", field_ids: [] }],
      },
    };

    expect(() =>
      validateBrowserApprovalResponse(approval, {
        type: "browser_authentication",
        action: "submit",
        selected_option: "email-code",
        fields: [],
      }),
    ).not.toThrow();
  });
  it("bounds both field length and UTF-8 payload size", () => {
    expect(
      browserApprovalResponseSchema.safeParse({
        ...response,
        fields: [{ field_id: "password", value: "a".repeat(16_385) }],
      }).success,
    ).toBe(false);
    const fields = Array.from({ length: 6 }, (_, i) => ({
      id: `field-${i}`,
      label: "Secret",
      type: "password",
      required: true,
    }));
    const approval = {
      ...browserTestApproval,
      request: {
        type: "browser_authentication" as const,
        credential_origin: "https://example.test",
        reason: null,
        fields,
        options: [],
      },
    };
    const large: BrowserApprovalResponse = {
      type: "browser_authentication",
      action: "submit",
      fields: fields.map((field) => ({ field_id: field.id, value: "界".repeat(16_000) })),
    };

    expect(browserApprovalResponseSchema.safeParse(large).success).toBe(true);
    expect(() => validateBrowserApprovalResponse(approval, large)).toThrow();
  });
});
