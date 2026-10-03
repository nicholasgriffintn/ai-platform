import {
  browserCredentialOriginSchema,
  type BrowserApproval,
  type BrowserApprovalResponse,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

export function validateBrowserApprovalResponse(
  approval: BrowserApproval,
  response: BrowserApprovalResponse,
): void {
  if (approval.request.type !== response.type) {
    throw new AssistantError(
      "Response does not match the pending browser request",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  if (
    response.type !== "browser_authentication" ||
    response.action === "cancel" ||
    approval.request.type !== "browser_authentication"
  ) {
    return;
  }

  const request = approval.request;

  if (!browserCredentialOriginSchema.safeParse(request.credential_origin).success) {
    throw new AssistantError(
      "Response does not match the pending browser request",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const selected = request.options.find((option) => option.id === response.selected_option);

  if (
    (request.options.length > 0 && !selected) ||
    (request.options.length === 0 && response.selected_option)
  ) {
    throw new AssistantError(
      "Response does not match the pending browser request",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const fields = selected
    ? request.fields.filter((field) => selected.field_ids.includes(field.id))
    : request.fields;
  const submitted = new Map(response.fields.map((field) => [field.field_id, field.value]));

  if (
    (selected &&
      selected.field_ids.some((id) => !request.fields.some((field) => field.id === id))) ||
    submitted.size !== response.fields.length ||
    response.fields.some((field) => !fields.some((allowed) => allowed.id === field.field_id)) ||
    fields.some((field) => field.required && !submitted.get(field.id)) ||
    (fields.length > 0 && response.fields.length === 0)
  ) {
    throw new AssistantError(
      "Response does not match the pending browser request",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  if (
    new TextEncoder().encode(
      JSON.stringify({ fields: response.fields, selected_option: response.selected_option }),
    ).byteLength >
    120 * 1024
  ) {
    throw new AssistantError(
      "Response does not match the pending browser request",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }
}
