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
}

/**
 * Simple mechanism for orchestrator agents to call team members
 */
export class TeamDelegation {
  private agentRepository: AgentRepository;

  constructor(private context: DelegationContext) {
    this.agentRepository = new AgentRepository(context.env);
  }

  /**
   * Call a specific team member agent
   */
  async callAgent(agentId: string, messages: Message[]): Promise<Message[]> {
    const agent = await this.agentRepository.getAgentById(agentId);

    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (agent.team_id !== this.context.currentAgent.team_id) {
      throw new Error(`Agent ${agentId} is not on the same team`);
    }

    logger.info(
      `Orchestrator ${this.context.currentAgent.name} calling team member ${agent.name}`,
    );

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
