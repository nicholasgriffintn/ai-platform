import type {
  DecisionQuestions,
  DecisionResponse,
  DecisionState,
} from "@ngriffin_uk/polychat-schemas";

export interface DecisionRequest {
  state: DecisionState;
  questions: DecisionQuestions;
  model?: string;
  completion_id?: string;
  conversationId?: string;
}

export interface DecisionProvider {
  readonly name: string;
  decide(request: DecisionRequest): Promise<DecisionResponse>;
}
