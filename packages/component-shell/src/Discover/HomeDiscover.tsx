import { lazy, Suspense } from "react";

const DiscoverBands = lazy(async () => {
  const module = await import("./DiscoverBands.js");

  return { default: module.DiscoverBands };
});

export function HomeDiscover() {
  return (
    <aside aria-label="Discover Polychat">
      <Suspense fallback={null}>
        <DiscoverBands variant="home" />
      </Suspense>
    </aside>
  );
}
