export interface ProviderCreditBalance {
  remaining: number;
  resetsAt: string | null;
}

export interface ProviderCreditBalanceReader {
  envKeyName: string;
  read(apiKey: string): Promise<ProviderCreditBalance | null>;
}
