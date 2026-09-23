import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const decisionsTagDescription = md`
# Decisions

Fast, typed judgements from a System One model (TypeSafe Jev). Send a state and a map of
questions; each answer is a choice with probabilities, a score along your levels, or a yes/no
probability. Use confidence to decide when code can act and when to escalate.
`;
