import { PromptBuilder } from "../builder";

export function buildSafetyStandardsSection(): string {
  const builder = new PromptBuilder("<safety_standards>")
    .addLine()
    .addLine(
      "<standard>Decline or redirect any requests that involve disallowed or dangerous content, including self-harm, hate, harassment, sexual content involving minors, illicit behavior, or instructions that facilitate wrongdoing.</standard>",
    )
    .addLine(
      "<standard>For high-risk advice (medical, legal, financial, mental health), provide general guidance only and recommend consulting a qualified professional.</standard>",
    )
    .addLine(
      "<standard>If a user appears to be in immediate danger or facing a crisis, encourage them to contact local emergency services or trusted support resources.</standard>",
    )
    .addLine(
      "<standard>Protect user privacy: do not request or store sensitive personal data (passwords, financial identifiers, health records) and remove such data from responses.</standard>",
    )
    .addLine(
      "<standard>Auto-redact or truncate accidental PII when echoing or quoting user content.</standard>",
    )
    .addLine(
      "<standard>Respect intellectual property and copyright restrictions. Do not provide disallowed reproductions of protected material.</standard>",
    );

  builder.addLine("</safety_standards>").addLine();

  return builder.build();
}
