/**
 * Shared context for stream transformers to coordinate data
 * Uses typed properties for known data and a Record for custom data
 */
export class StreamContext {
  private fullContent = "";
  private fullThinking = "";
  private signature = "";
  private citations: any[] = [];
  private usage: any = null;
  private toolCalls: any[] = [];

  private customData: Record<string, any> = {};

  setContent(content: string): void {
    this.fullContent = content;
  }

  getContent(): string {
    return this.fullContent;
  }

  setThinking(thinking: string): void {
    this.fullThinking = thinking;
  }

  getThinking(): string {
    return this.fullThinking;
  }

  setSignature(signature: string): void {
    this.signature = signature;
  }

  getSignature(): string {
    return this.signature;
  }

  setCitations(citations: any[]): void {
    this.citations = citations;
  }

  getCitations(): any[] {
    return this.citations;
  }

  setUsage(usage: any): void {
    this.usage = usage;
  }

  getUsage(): any {
    return this.usage;
  }

  setToolCalls(toolCalls: any[]): void {
    this.toolCalls = toolCalls;
  }

  getToolCalls(): any[] {
    return this.toolCalls;
  }

  setCustom(key: string, value: any): void {
    this.customData[key] = value;
  }

  getCustom<T>(key: string): T | undefined {
    return this.customData[key];
  }

  hasCustom(key: string): boolean {
    return key in this.customData;
  }

  getAll(): Record<string, any> {
    return {
      fullContent: this.fullContent,
      fullThinking: this.fullThinking,
      signature: this.signature,
      citations: this.citations,
      usage: this.usage,
      ...this.customData,
    };
  }

  clear(): void {
    this.fullContent = "";
    this.fullThinking = "";
    this.signature = "";
    this.citations = [];
    this.usage = null;
    this.customData = {};
  }
}
