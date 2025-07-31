import type { Agent } from "~/lib/database/schema";
import { AgentRepository } from "~/repositories/AgentRepository";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import type { AnonymousUser, IEnv, IUser, Message } from "~/types";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "AGENTS_TEAM_DELEGATION" });

export interface DelegationContext {
  env: IEnv;
  user?: IUser;
  anonymousUser?: AnonymousUser;
  currentAgent: Agent;
  delegationStack?: string[];
  maxDelegationDepth?: number;
  rateLimitWindowMs?: number;
  maxDelegationsPerWindow?: number;
}

interface DelegationCall {
  timestamp: number;
  agentId: string;
}

/**
 * Simple mechanism for orchestrator agents to call team members
 */
export class TeamDelegation {
  private agentRepository: AgentRepository;
  private delegationStack: string[];
  private maxDelegationDepth: number;
  private rateLimitWindowMs: number;
  private maxDelegationsPerWindow: number;
  private delegationCalls: DelegationCall[] = [];

  constructor(private context: DelegationContext) {
    this.agentRepository = new AgentRepository(context.env);
    this.delegationStack = context.delegationStack || [context.currentAgent.id];
    this.maxDelegationDepth = context.maxDelegationDepth || 5;
    this.rateLimitWindowMs = context.rateLimitWindowMs || 60000;
    this.maxDelegationsPerWindow = context.maxDelegationsPerWindow || 10;
  }

  private checkRateLimit(): void {
    const now = Date.now();
    const windowStart = now - this.rateLimitWindowMs;

    this.delegationCalls = this.delegationCalls.filter(
      (call) => call.timestamp > windowStart,
    );

    if (this.delegationCalls.length >= this.maxDelegationsPerWindow) {
      const oldestCall = this.delegationCalls[0];
      const resetTime = oldestCall.timestamp + this.rateLimitWindowMs;
      const resetIn = Math.ceil((resetTime - now) / 1000);

      throw new Error(
        `Rate limit exceeded: ${this.maxDelegationsPerWindow} delegations per ${this.rateLimitWindowMs / 1000}s. ` +
          `Try again in ${resetIn} seconds. Current delegation stack: ${this.delegationStack.join(" -> ")}`,
      );
    }
  }

  private recordDelegation(agentId: string): void {
    this.delegationCalls.push({
      timestamp: Date.now(),
      agentId,
    });
  }

  /**
   * Call a specific team member agent
   */
  async callAgent(agentId: string, messages: Message[]): Promise<Message[]> {
    this.checkRateLimit();

    if (this.delegationStack.includes(agentId)) {
      const cycle = this.delegationStack
        .slice(this.delegationStack.indexOf(agentId))
        .join(" -> ");
      throw new Error(`Circular delegation detected: ${cycle} -> ${agentId}`);
    }

    if (this.delegationStack.length >= this.maxDelegationDepth) {
      throw new Error(
        `Maximum delegation depth of ${this.maxDelegationDepth} exceeded. Current stack: ${this.delegationStack.join(" -> ")}`,
      );
    }

    const agent = await this.agentRepository.getAgentById(agentId);

    if (!agent) {
      throw new Error(
        `Target agent '${agentId}' not found. Verify the agent ID is correct and the agent exists.`,
      );
    }

    if (agent.team_id !== this.context.currentAgent.team_id) {
      throw new Error(
        `Team mismatch: Agent '${agent.name}' (${agentId}) belongs to team '${agent.team_id}' ` +
          `but current agent '${this.context.currentAgent.name}' belongs to team '${this.context.currentAgent.team_id}'. ` +
          `Agents can only delegate within their own team.`,
      );
    }

    this.recordDelegation(agentId);

    logger.info(
      `Orchestrator ${this.context.currentAgent.name} calling team member ${agent.name}. Stack: ${this.delegationStack.join(" -> ")}`,
    );

    const nestedStack = [...this.delegationStack, agentId];

    const response = await handleCreateChatCompletions({
      env: this.context.env,
      request: {
        env: this.context.env,
        messages,
        model: agent.model || "mistral-medium",
        system_prompt: agent.system_prompt,
        temperature: agent.temperature
          ? Number.parseFloat(agent.temperature)
          : 0.7,
        max_steps: agent.max_steps || 20,
        stream: false,
        mode: "agent",
        current_agent_id: agentId,
        delegation_stack: nestedStack,
        max_delegation_depth: this.maxDelegationDepth,
      },
      user: this.context.user,
      anonymousUser: this.context.anonymousUser,
    });

    if (response && typeof response === "object" && "messages" in response) {
      return response.messages as Message[];
    }

    return [];
  }

  /**
   * Get all team members for the current agent
   */
  async getTeamMembers(): Promise<Agent[]> {
    if (!this.context.currentAgent.team_id || !this.context.user?.id) {
      return [];
    }

    const allTeamMembers = await this.agentRepository.getAgentsByTeamAndUser(
      this.context.currentAgent.team_id,
      this.context.user.id,
    );

    return allTeamMembers.filter(
      (agent) => agent.id !== this.context.currentAgent.id,
    );
  }

  /**
   * Find appropriate team member by role
   */
  async findAgentByRole(role: string): Promise<Agent | null> {
    const teamMembers = await this.getTeamMembers();
    return teamMembers.find((agent) => agent.team_role === role) || null;
  }
}
