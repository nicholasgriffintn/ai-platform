import { describe, expect, it, vi } from "vitest";

import { OutputRepository } from "../OutputRepository";

describe("OutputRepository", () => {
  it("revokes a share without updating columns absent from output_share", async () => {
    const run = vi.fn().mockResolvedValue({ success: true });
    const bind = vi.fn().mockReturnValue({ run });
    const prepare = vi.fn().mockReturnValue({ bind });
    const repository = new OutputRepository({ DB: { prepare } } as any);

    await repository.revokeShare("output-1", "share-1");

    expect(prepare).toHaveBeenCalledWith(
      "UPDATE output_share SET revoked_at = ? WHERE id = ? AND output_id = ? AND revoked_at IS NULL",
    );
    expect(bind).toHaveBeenCalledWith(expect.any(String), "share-1", "output-1");
    expect(run).toHaveBeenCalledOnce();
  });
});
