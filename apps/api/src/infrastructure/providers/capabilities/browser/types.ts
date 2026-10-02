import type {
  BrowserProvider,
  BrowserSessionSnapshot,
  SubmitBrowserApproval,
} from "@ngriffin_uk/polychat-schemas";

export interface BrowserSessionProvider {
  readonly name: BrowserProvider;
  create(input: {
    model: string;
    allowedDomains?: string[];
    referenceId: string;
    task: string;
  }): Promise<string>;
  recover(referenceId: string): Promise<string | null>;
  inspect(sessionId: string): Promise<BrowserSessionSnapshot>;
  respond(sessionId: string, input: SubmitBrowserApproval): Promise<void>;
  cancel(sessionId: string): Promise<void>;
  destroy(sessionId: string): Promise<void>;
}
