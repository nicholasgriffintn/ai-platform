import type { DocumentEditProposal } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

import type { DocumentDiscussionProps } from "./DocumentDiscussion";

export function useDocumentCommentDraft(
  onSubmit: (body: string, mentionedTeammateId: string | null) => Promise<boolean>,
) {
  const [body, setBody] = useState("");
  const [teammateId, setTeammateId] = useState("");

  async function submitComment() {
    const saved = await onSubmit(body, teammateId || null);

    if (saved) {
      setBody((current) => (current === body ? "" : current));
      setTeammateId((current) => (current === teammateId ? "" : current));
    }

    return saved;
  }

  return { body, setBody, teammateId, setTeammateId, submitComment };
}

export function useDocumentDiscussionDraft(
  actions: Pick<DocumentDiscussionProps, "onComment" | "onPropose" | "onApply">,
) {
  const comment = useDocumentCommentDraft((body, teammateId) =>
    actions.onComment(body, null, teammateId),
  );
  const [instructions, setInstructions] = useState("");
  const [proposal, setProposal] = useState<DocumentEditProposal | null>(null);

  async function proposeEdit() {
    const suggested = await actions.onPropose(instructions);

    if (suggested) {
      setProposal(suggested);
    }
  }

  async function applyEdit() {
    if (proposal && (await actions.onApply(proposal))) {
      setProposal((current) => (current === proposal ? null : current));
    }
  }

  function changeReplacement(replacement: string) {
    setProposal((current) => (current ? { ...current, replacement } : null));
  }

  return {
    ...comment,
    instructions,
    setInstructions,
    proposal,
    proposeEdit,
    applyEdit,
    changeReplacement,
    dismissProposal: () => setProposal(null),
  };
}
