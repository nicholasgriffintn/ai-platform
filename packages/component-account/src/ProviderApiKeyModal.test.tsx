import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { ProviderApiKeyModal } from "./ProviderApiKeyModal";

afterEach(cleanup);

it("submits DynamoDB credentials as separate access and secret keys", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);

  render(
    <ProviderApiKeyModal
      open
      onOpenChange={vi.fn()}
      providerId="dynamodb-vectors"
      providerName="DynamoDB Vectors"
      onSubmit={onSubmit}
    />,
  );
  const save = screen.getByRole("button", { name: "Save" });

  fireEvent.change(screen.getByLabelText("AWS Access Key ID"), {
    target: { value: "test-access" },
  });
  expect(save.hasAttribute("disabled")).toBe(true);
  fireEvent.change(screen.getByLabelText("AWS Secret Access Key"), {
    target: { value: "test-secret" },
  });
  fireEvent.click(save);
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith({
      apiKey: "test-access",
      secretKey: "test-secret",
      configuration: undefined,
    }),
  );
});
