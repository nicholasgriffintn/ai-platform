import type { CouncilReviewSeat } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { readCouncilAdjudication, readCouncilVote } from "../council-review";

function seat(vote: CouncilReviewSeat["vote"]): CouncilReviewSeat {
  return { memberId: "sceptic", critique: "", rebuttal: "", vote };
}

describe("council review verdicts", () => {
  it("reads a seat's vote and treats a missing vote as hold", () => {
    expect(readCouncilVote("The figures check out.\nVOTE: ship")).toEqual({
      rebuttal: "The figures check out.",
      vote: "ship",
    });
    expect(readCouncilVote("I would not send this.").vote).toBe("hold");
  });

  it("never lets the adjudicator ship over a seat that asked for changes", () => {
    const raw = JSON.stringify({ verdict: "ship", brief: "Ready.", dissent: [] });

    expect(readCouncilAdjudication(raw, [seat("ship"), seat("revise")]).verdict).toBe("revise");
    expect(readCouncilAdjudication(raw, [seat("ship"), seat("hold")]).verdict).toBe("hold");
    expect(readCouncilAdjudication(raw, [seat("ship"), seat("ship")]).verdict).toBe("ship");
  });

  it("falls back to the seats' votes when the adjudicator returns nothing usable", () => {
    expect(readCouncilAdjudication("not json", [seat("ship"), seat("revise")])).toMatchObject({
      verdict: "revise",
      dissent: [],
    });
  });
});
