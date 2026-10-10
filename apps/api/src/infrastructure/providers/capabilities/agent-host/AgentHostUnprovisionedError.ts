export class AgentHostUnprovisionedError extends Error {
  constructor() {
    super("The hosted agent has not been provisioned");
    this.name = "AgentHostUnprovisionedError";
  }
}
