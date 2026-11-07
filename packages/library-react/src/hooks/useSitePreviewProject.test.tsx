import { fetchApi } from "@ngriffin_uk/polychat-library-client";
import { collectSiteImageSlots, validateSiteProject } from "@ngriffin_uk/polychat-library-sites";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSitePreviewProject } from "./useSitePreviewProject.js";

vi.mock("@ngriffin_uk/polychat-library-client", () => ({ fetchApi: vi.fn() }));

const privateImage = "https://api.polychat.app/outputs/image-1/content";
const publicImage = "https://example.com/photo.jpg";
const { project } = validateSiteProject({
  title: "Crumb",
  description: "A bakery.",
  pages: {
    home: {
      root: "page",
      elements: {
        page: { type: "Page", props: {}, children: ["one", "two"] },
        one: { type: "Image", props: { alt: "Loaf", src: privateImage }, children: [] },
        two: { type: "Image", props: { alt: "Shop", src: publicImage }, children: [] },
      },
    },
  },
});

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  );
}

describe("useSitePreviewProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gives the sandboxed preview private images it can display", async () => {
    vi.mocked(fetchApi).mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["image"], { type: "image/png" }),
    } as Response);

    const { result } = renderHook(() => useSitePreviewProject(project), { wrapper });

    await waitFor(() => {
      expect(collectSiteImageSlots(result.current!)[0]?.src).toMatch(/^data:image\/png;base64,/);
    });

    expect(fetchApi).toHaveBeenCalledTimes(1);
    expect(fetchApi).toHaveBeenCalledWith("/outputs/image-1/content");
    expect(collectSiteImageSlots(result.current!)[1]?.src).toBe(publicImage);
  });

  it("keeps the original source when an image cannot be read", async () => {
    vi.mocked(fetchApi).mockResolvedValue({ ok: false } as Response);

    const { result } = renderHook(() => useSitePreviewProject(project), { wrapper });

    await waitFor(() => {
      expect(collectSiteImageSlots(result.current!)[0]?.src).toBe(privateImage);
    });
  });
});
