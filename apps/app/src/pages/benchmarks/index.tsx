import {
  BenchmarksIndex,
  PageShell,
  StandardSidebarContent,
} from "@ngriffin_uk/polychat-component-shell";

export function meta() {
  return [
    { title: "Benchmarks - Polychat" },
    {
      name: "description",
      content:
        "Small, honest model benchmarks: GeoGuess, Countdown, Fermi Bets, Long Odds, Hamster Wheel and Strudel Groove, with intervals, costs and a board you can play yourself.",
    },
  ];
}

export default function Benchmarks() {
  return (
    <PageShell
      title="Benchmarks"
      headerTitleAs="span"
      sidebarContent={<StandardSidebarContent />}
      className="max-w-6xl"
    >
      <BenchmarksIndex />
    </PageShell>
  );
}
