import { API_BASE_URL } from "@ngriffin_uk/polychat-library-client";
import { describe, expect, it } from "vitest";

import { getApiOriginMismatch } from "./api-origin";

describe("the desktop API origin", () => {
  it("accepts a host that signs in against the API the window calls", () => {
    expect(getApiOriginMismatch(API_BASE_URL)).toBeNull();
    expect(getApiOriginMismatch(`${API_BASE_URL}/`)).toBeNull();
  });

  it("names both origins when the host and the window disagree", () => {
    const mismatch = getApiOriginMismatch("https://staging.polychat.app");

    expect(mismatch).toContain("https://staging.polychat.app");
    expect(mismatch).toContain(API_BASE_URL);
  });
});
