import { describe, expect, it } from "vitest";

import { evaluateCountdownExpression } from "../countdown/expression.js";
import { COUNTDOWN_ROUNDS } from "../data/countdown-rounds.js";
import { fermiIntervalScore } from "../definitions/fermi-bets.js";
import { getBenchmark } from "../registry.js";

describe("countdown", () => {
  it("ships rounds whose stored solutions follow the rules and reach the stored best", () => {
    for (const round of COUNTDOWN_ROUNDS) {
      expect(evaluateCountdownExpression(round.solution, round.numbers)).toEqual({
        ok: true,
        value: round.best,
      });
    }
  });

  it("rejects reused numbers, inexact division and non-positive steps", () => {
    const numbers = [100, 75, 6, 4, 3, 2];

    expect(evaluateCountdownExpression("100 + 100", numbers).ok).toBe(false);
    expect(evaluateCountdownExpression("75 / 2", numbers).ok).toBe(false);
    expect(evaluateCountdownExpression("3 - 4 + 100", numbers).ok).toBe(false);
    expect(evaluateCountdownExpression("alert(1)", numbers).ok).toBe(false);
    expect(evaluateCountdownExpression("(100 + 6) × 3", numbers)).toEqual({ ok: true, value: 318 });
  });

  it("scores by distance with the show's bands and zero for broken working", () => {
    const countdown = getBenchmark("countdown");
    const round = COUNTDOWN_ROUNDS[0];

    expect(countdown.score(round.id, { expression: round.solution }).score).toBe(
      round.best === round.target ? 1 : 0.7,
    );
    expect(countdown.score(round.id, { expression: "1 + 1 + 1" }).score).toBe(0);
    expect(countdown.score(round.id, { nonsense: true }).detail.invalid).toBe(true);
  });
});

describe("geoguess", () => {
  it("reads a fenced JSON guess and scores a perfect pin at full marks", () => {
    const geoguess = getBenchmark("geoguess");
    const reveal = geoguess.reveal("photo-001");
    const answer = geoguess.parseOutput(
      `Looks Iberian.\n\`\`\`json\n{"lat": ${String(reveal.lat)}, "lng": ${String(reveal.lng)}, "country": "${String(reveal.country)}"}\n\`\`\``,
    );
    const result = geoguess.score("photo-001", answer);

    expect(result.score).toBeCloseTo(1, 5);
    expect(result.detail).toMatchObject({ km: 0, countryHit: true });
    expect(geoguess.score("photo-001", { lat: -Number(reveal.lat), lng: 0 }).score).toBeLessThan(
      0.1,
    );
  });

  it("never exposes the answer in what players and models see", () => {
    const geoguess = getBenchmark("geoguess");
    const item = JSON.stringify(geoguess.publicItem("photo-001"));
    const reveal = geoguess.reveal("photo-001");

    expect(item).toContain('"imagePath":"/benchmarks/geoguess/photos/photo-001"');

    for (const secret of [reveal.place, reveal.lat, reveal.lng, reveal.sourceUrl, "panoramax"]) {
      expect(item.toLowerCase()).not.toContain(String(secret).toLowerCase());
    }
  });
});

describe("calibration scoring", () => {
  it("rewards tight intervals that hold the answer over wide ones, and punishes misses", () => {
    const tight = fermiIntervalScore({ estimate: 330, low: 300, high: 360 }, 330);
    const wide = fermiIntervalScore({ estimate: 330, low: 30, high: 3300 }, 330);
    const miss = fermiIntervalScore({ estimate: 200, low: 180, high: 220 }, 330);

    expect(tight).toBeGreaterThan(wide);
    expect(wide).toBeGreaterThan(miss);
  });

  it("gives a coin flip 75 and a confident mistake nothing on Long Odds", () => {
    const longOdds = getBenchmark("long-odds");

    expect(longOdds.score("sydney-capital", { probability: 0.5 }).score).toBe(0.75);
    expect(longOdds.score("sydney-capital", { probability: 1 }).score).toBe(0);
    expect(longOdds.fromDecision(0.2)).toEqual({ probability: 0.2 });
  });
});
