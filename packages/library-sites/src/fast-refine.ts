import {
  DECISION_CONFIDENCE_THRESHOLDS,
  SITE_PALETTES,
  decisionChoiceSelection,
  type DecisionChoiceAnswer,
  type DecisionChoiceQuestion,
  type SiteElementStyle,
  type SiteElementTarget,
  type SitePalette,
  type SitePatch,
  type SiteProject,
} from "@ngriffin_uk/polychat-schemas";

import type { SiteComponentType } from "./catalog.js";
import { collectSiteElementRefinementContext, elementPatchPath } from "./edit.js";

export const SITE_FAST_REFINE_FALLBACK_ID = "coding_model";

export interface SiteFastRefineCandidate {
  id: string;
  description: string;
  summary: string;
  patch: SitePatch;
}

const STYLE_OPTIONS = {
  width: ["narrow", "content", "wide", "full"],
  spacing: ["none", "compact", "normal", "generous", "dramatic"],
  align: ["start", "center", "end"],
  surface: ["transparent", "canvas", "muted", "card", "primary", "inverted", "glass"],
  border: ["none", "subtle", "strong"],
  shadow: ["none", "sm", "md", "xl"],
  radius: ["none", "sm", "md", "lg", "xl", "full"],
  motion: ["none", "fade", "rise", "scale", "slide"],
} as const satisfies Partial<Record<keyof SiteElementStyle, readonly string[]>>;

const COMPONENT_PROP_OPTIONS: Partial<
  Record<SiteComponentType, Record<string, readonly (string | number)[]>>
> = {
  Section: {
    padding: ["sm", "md", "lg"],
    width: ["narrow", "default", "wide", "full"],
    background: ["default", "muted", "primary", "inverted"],
  },
  Stack: { gap: ["none", "xs", "sm", "md", "lg", "xl"] },
  Grid: { columns: [1, 2, 3, 4, 5, 6], gap: ["none", "xs", "sm", "md", "lg", "xl"] },
  Card: { padding: ["none", "sm", "md", "lg"] },
  Heading: { size: ["sm", "md", "lg", "xl", "display"] },
  Text: { size: ["xs", "sm", "md", "lg"], weight: ["normal", "medium", "semibold"] },
  Button: { size: ["sm", "md", "lg"] },
  Image: { aspect: ["square", "video", "portrait", "wide", "auto"] },
  Icon: { size: ["sm", "md", "lg"] },
  Avatar: { size: ["sm", "md", "lg"] },
};

const PALETTE_DESCRIPTIONS: Record<SitePalette, string> = {
  neutral: "neutral grey",
  slate: "slate blue-grey",
  ocean: "ocean blue",
  forest: "forest green",
  sunset: "warm orange",
  berry: "berry pink-red",
  sand: "warm sand beige",
  midnight: "midnight purple",
};

function styleCandidate(
  pageId: string,
  elementKey: string,
  style: SiteElementStyle,
  id: string,
  description: string,
  summary: string,
): SiteFastRefineCandidate {
  return {
    id,
    description,
    summary,
    patch: {
      op: "replace",
      path: elementPatchPath(pageId, elementKey, "style"),
      value: style,
    },
  };
}

export function buildSiteFastRefineCandidates(
  project: SiteProject,
  target: SiteElementTarget,
): SiteFastRefineCandidate[] {
  const element = project.pages[target.pageId]?.elements[target.elementKey];

  if (!element) {
    return [];
  }

  const currentStyle = element.style ?? {};
  const candidates: SiteFastRefineCandidate[] = [];

  for (const [property, values] of Object.entries(STYLE_OPTIONS)) {
    for (const value of values) {
      if (currentStyle[property as keyof SiteElementStyle] === value) {
        continue;
      }

      candidates.push(
        styleCandidate(
          target.pageId,
          target.elementKey,
          { ...currentStyle, [property]: value },
          `style-${property}-${value}`,
          `Set the selected ${element.type} ${property} to ${value}. Use only when the request asks for this one visual adjustment.`,
          `Set ${element.type} ${property} to ${value}`,
        ),
      );
    }
  }

  for (const palette of SITE_PALETTES) {
    const colour = PALETTE_DESCRIPTIONS[palette];

    if (currentStyle.palette !== palette) {
      candidates.push(
        styleCandidate(
          target.pageId,
          target.elementKey,
          { ...currentStyle, palette },
          `palette-${palette}`,
          `Use ${colour} for the selected ${element.type}'s existing semantic accents or controls without changing its layout or surface.`,
          `Changed ${element.type} accents to ${colour}`,
        ),
      );
    }

    if (currentStyle.palette !== palette || currentStyle.surface !== "primary") {
      candidates.push(
        styleCandidate(
          target.pageId,
          target.elementKey,
          { ...currentStyle, palette, surface: "primary", tone: "inherit" },
          `background-${palette}`,
          `Give the selected ${element.type} a solid ${colour} background with readable contrasting text.`,
          `Changed ${element.type} background to ${colour}`,
        ),
      );
    }

    if (
      currentStyle.surface !== "primary" &&
      currentStyle.surface !== "inverted" &&
      (currentStyle.palette !== palette || currentStyle.tone !== "primary")
    ) {
      candidates.push(
        styleCandidate(
          target.pageId,
          target.elementKey,
          { ...currentStyle, palette, tone: "primary" },
          `text-${palette}`,
          `Make the selected ${element.type}'s text ${colour}. Do not choose this for a background-colour request.`,
          `Changed ${element.type} text to ${colour}`,
        ),
      );
    }
  }

  const propOptions = COMPONENT_PROP_OPTIONS[element.type as SiteComponentType];

  for (const [property, values] of Object.entries(propOptions ?? {})) {
    const currentValue = element.props[property];
    const currentDescription =
      typeof currentValue === "string" ||
      typeof currentValue === "number" ||
      typeof currentValue === "boolean"
        ? String(currentValue)
        : "its default";

    for (const value of values) {
      if (currentValue === value) {
        continue;
      }

      candidates.push({
        id: `prop-${property}-${value}`,
        description: `Set the selected ${element.type} ${property} prop from ${currentDescription} to ${value}. Use only when this exactly and completely satisfies the request.`,
        summary: `Set ${element.type} ${property} to ${value}`,
        patch: {
          op: "replace",
          path: elementPatchPath(target.pageId, target.elementKey, "props", property),
          value,
        },
      });
    }
  }

  return candidates;
}

export function buildSiteFastRefineQuestion(
  candidates: readonly SiteFastRefineCandidate[],
): DecisionChoiceQuestion {
  return {
    type: "choice",
    instructions:
      "Can one listed action fully satisfy the request exactly as written? Choose coding_model for copy edits, compound requests, ambiguity, structural or behavioural changes, or whenever one action is insufficient.",
    criteria: {
      [SITE_FAST_REFINE_FALLBACK_ID]:
        "Use the coding model. This is the safe default for anything beyond one exact visual or enum-prop change.",
      ...Object.fromEntries(candidates.map((candidate) => [candidate.id, candidate.description])),
    },
  };
}

export function buildSiteFastRefineState(
  request: string,
  project: SiteProject,
  target: SiteElementTarget,
) {
  const page = project.pages[target.pageId];

  return {
    request,
    selectedElement: JSON.stringify(
      page ? collectSiteElementRefinementContext(page, target.elementKey) : {},
    ),
  };
}

export function resolveSiteFastRefineCandidate(
  answer: DecisionChoiceAnswer | undefined,
  candidates: readonly SiteFastRefineCandidate[],
): SiteFastRefineCandidate | null {
  if (!answer) {
    return null;
  }

  const selected = decisionChoiceSelection(answer);
  const selectedConfidence = answer.probabilities[selected] ?? answer.confidence;

  if (
    answer.confidence < DECISION_CONFIDENCE_THRESHOLDS.act ||
    selectedConfidence < DECISION_CONFIDENCE_THRESHOLDS.act ||
    selected === SITE_FAST_REFINE_FALLBACK_ID
  ) {
    return null;
  }

  return candidates.find((candidate) => candidate.id === selected) ?? null;
}
