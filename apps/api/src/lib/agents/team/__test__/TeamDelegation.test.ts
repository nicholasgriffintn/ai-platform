import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAIResponse } from "~/lib/chat/responses";
import { AgentRepository } from "~/repositories/AgentRepository";
import type { Agent, IEnv, IUser, Message } from "~/types";
import { TeamDelegation } from "../TeamDelegation";

vi.mock("~/repositories/AgentRepository");
vi.mock("~/lib/chat/responses");
vi.mock("~/lib/models", () => ({
  getAuxiliaryModel: vi.fn().mockResolvedValue({
    model: "mistral-medium-latest",
    provider: "mistral",
  }),
  getModelConfig: vi.fn().mockResolvedValue({
    matchingModel: "mistral-medium-latest",
  }),
}));
vi.mock("~/utils/logger", () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
  })),
}));

describe("TeamDelegation", () => {
  let mockEnv: IEnv;
  let mockUser: IUser;
  let mockCurrentAgent: Agent;
  let mockAgentRepository: any;
  let teamDelegation: TeamDelegation;

  beforeEach(() => {
    vi.clearAllMocks();

    mockEnv = {} as IEnv;
    mockUser = { id: 1 } as IUser;
    mockCurrentAgent = {
      id: "current-agent-id",
      user_id: 1,
      team_id: "team-1",
      name: "Current Agent",
      description: "Test agent",
      model: "test-model",
      system_prompt: "Test prompt",
      temperature: "0.7",
      max_steps: 20,
    } as Agent;

    mockAgentRepository = {
      getAgentById: vi.fn(),
      getAgentsByTeamAndUser: vi.fn(),
    };

    (AgentRepository as any).mockImplementation(() => mockAgentRepository);

    teamDelegation = new TeamDelegation({
      env: mockEnv,
      user: mockUser,
      currentAgent: mockCurrentAgent,
    });
  });

  describe("callAgent", () => {
    it("should successfully call a team member agent", async () => {
      const targetAgent: Agent = {
        id: "target-agent-id",
        user_id: 1,
        team_id: "team-1",
        name: "Target Agent",
        description: "Target test agent",
        model: "test-model",
        system_prompt: "Target prompt",
        temperature: "0.8",
        max_steps: 15,
      } as Agent;

      const messages: Message[] = [{ role: "user", content: "Test task" }];

      const mockResponse = {
        response: "Task completed successfully",
      };

      mockAgentRepository.getAgentById.mockResolvedValue(targetAgent);
      (getAIResponse as any).mockResolvedValue(mockResponse);

      const result = await teamDelegation.callAgent(
        "target-agent-id",
        messages,
      );

      expect(mockAgentRepository.getAgentById).toHaveBeenCalledWith(
        "target-agent-id",
      );
      expect(getAIResponse).toHaveBeenCalledWith({
        env: mockEnv,
        user: mockUser,
        messages,
        model: "mistral-medium-latest",
        system_prompt: "Target prompt",
        temperature: 0.8,
        stream: false,
        mode: "agent",
      });
      expect(result).toEqual([
        { role: "assistant", content: "Task completed successfully" },
      ]);
    });

    it("should throw error when agent not found", async () => {
      mockAgentRepository.getAgentById.mockResolvedValue(null);

      await expect(
        teamDelegation.callAgent("nonexistent-agent", []),
      ).rejects.toThrow("Target agent 'nonexistent-agent' not found");
    });

    it("should throw error when agent is not on same team", async () => {
      const targetAgent: Agent = {
        id: "target-agent-id",
        user_id: 1,
        team_id: "different-team",
        name: "Target Agent",
      } as Agent;

      mockAgentRepository.getAgentById.mockResolvedValue(targetAgent);

      await expect(
        teamDelegation.callAgent("target-agent-id", []),
      ).rejects.toThrow("Team mismatch: Agent 'Target Agent'");
    });

    it("should detect circular delegation", async () => {
      const targetAgent: Agent = {
        id: "current-agent-id", // Same as current agent
        user_id: 1,
        team_id: "team-1",
        name: "Target Agent",
      } as Agent;

      mockAgentRepository.getAgentById.mockResolvedValue(targetAgent);

      await expect(
        teamDelegation.callAgent("current-agent-id", []),
      ).rejects.toThrow(
        "Circular delegation detected: current-agent-id -> current-agent-id",
      );
    });

    it("should enforce maximum delegation depth", async () => {
      const teamDelegationWithStack = new TeamDelegation({
        env: mockEnv,
        user: mockUser,
        currentAgent: mockCurrentAgent,
        delegationStack: ["agent1", "agent2", "agent3", "agent4", "agent5"], // At max depth
        maxDelegationDepth: 5,
      });

      const targetAgent: Agent = {
        id: "target-agent-id",
        user_id: 1,
        team_id: "team-1",
        name: "Target Agent",
      } as Agent;

      mockAgentRepository.getAgentById.mockResolvedValue(targetAgent);

      await expect(
        teamDelegationWithStack.callAgent("target-agent-id", []),
      ).rejects.toThrow("Maximum delegation depth of 5 exceeded");
    });
  });

  describe("getTeamMembers", () => {
    it("should return team members excluding current agent", async () => {
      const teamMembers: Agent[] = [
        {
          id: "current-agent-id",
          name: "Current Agent",
        } as Agent,
        {
          id: "team-member-1",
          name: "Team Member 1",
        } as Agent,
        {
          id: "team-member-2",
          name: "Team Member 2",
        } as Agent,
      ];

      mockAgentRepository.getAgentsByTeamAndUser.mockResolvedValue(teamMembers);

      const result = await teamDelegation.getTeamMembers();

      expect(mockAgentRepository.getAgentsByTeamAndUser).toHaveBeenCalledWith(
        "team-1",
        1,
      );
      expect(result).toHaveLength(2);
      expect(result).not.toContain(teamMembers[0]); // Current agent should be excluded
      expect(result[0].id).toBe("team-member-1");
      expect(result[1].id).toBe("team-member-2");
    });

    it("should return empty array when no team_id", async () => {
      const agentWithoutTeam = { ...mockCurrentAgent, team_id: null };
      const teamDelegationNoTeam = new TeamDelegation({
        env: mockEnv,
        user: mockUser,
        currentAgent: agentWithoutTeam,
      });

      const result = await teamDelegationNoTeam.getTeamMembers();

      expect(result).toEqual([]);
      expect(mockAgentRepository.getAgentsByTeamAndUser).not.toHaveBeenCalled();
    });

    it("should return empty array when no user", async () => {
      const teamDelegationNoUser = new TeamDelegation({
        env: mockEnv,
        currentAgent: mockCurrentAgent,
      });

      const result = await teamDelegationNoUser.getTeamMembers();

      expect(result).toEqual([]);
      expect(mockAgentRepository.getAgentsByTeamAndUser).not.toHaveBeenCalled();
    });
  });

  describe("findAgentByRole", () => {
    it("should find agent by role", async () => {
      const teamMembers: Agent[] = [
        {
          id: "specialist-agent",
          name: "Specialist Agent",
          team_role: "specialist",
        } as Agent,
        {
          id: "coordinator-agent",
          name: "Coordinator Agent",
          team_role: "coordinator",
        } as Agent,
      ];

      mockAgentRepository.getAgentsByTeamAndUser.mockResolvedValue([
        mockCurrentAgent,
        ...teamMembers,
      ]);

      const result = await teamDelegation.findAgentByRole("specialist");

      expect(result).toBe(teamMembers[0]);
    });

    it("should return null when role not found", async () => {
      const teamMembers: Agent[] = [
        {
          id: "coordinator-agent",
          name: "Coordinator Agent",
          team_role: "coordinator",
        } as Agent,
      ];

      mockAgentRepository.getAgentsByTeamAndUser.mockResolvedValue([
        mockCurrentAgent,
        ...teamMembers,
      ]);

      const result = await teamDelegation.findAgentByRole("specialist");

      expect(result).toBeNull();
    });
  });
});
