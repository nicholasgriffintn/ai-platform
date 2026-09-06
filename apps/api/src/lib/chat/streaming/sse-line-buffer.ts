export class SseLineBuffer {
  private pending = "";

  constructor(private readonly maxEventLength: number) {}

  append(chunk: string): string[] {
    this.pending += chunk;
    const lines = this.pending.split("\n");

    this.pending = lines.pop() ?? "";

    if (
      this.pending.length > this.maxEventLength ||
      lines.some((line) => line.length > this.maxEventLength)
    ) {
      throw new Error(`Provider stream event exceeded ${this.maxEventLength} characters`);
    }

    return lines;
  }
}
