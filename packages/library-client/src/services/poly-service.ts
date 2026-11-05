import {
  standingApprovalId,
  standingApprovalSchema,
  polyLookAroundSchema,
  polyRoutineSetupSchema,
  polyRoutinesSchema,
  type PolyAgenda,
  type PolyLookAround,
  type PolyRoutineSetup,
  type PolyRoutines,
  type PolyRoutineTemplateId,
  type SetupPolyRoutine,
  type UpdatePolyLookAround,
  type PolyHandoffDisagreement,
  type StandingApproval,
} from "@ngriffin_uk/polychat-schemas";

import { fetchApi } from "../fetch-wrapper.js";
import { createApiErrorFromResponse, returnFetchedData } from "../http.js";
import { requestJson } from "../resource.js";

export class PolyService {
  constructor(private getHeaders: () => Promise<Record<string, string>>) {}

  async readPolyAgenda(): Promise<PolyAgenda> {
    const response = await fetchApi("/poly/agenda", {
      method: "GET",
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw await createApiErrorFromResponse(response, "Failed to load what Poly is doing");
    }

    return returnFetchedData<PolyAgenda>(response);
  }

  async disagreeWithPolyHandoff(handoffId: string): Promise<PolyHandoffDisagreement> {
    const response = await fetchApi(`/poly/handoffs/${encodeURIComponent(handoffId)}/disagree`, {
      method: "POST",
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw await createApiErrorFromResponse(response, "Poly could not take that on board");
    }

    return returnFetchedData<PolyHandoffDisagreement>(response);
  }

  async setPolyLookAround(input: UpdatePolyLookAround): Promise<PolyLookAround> {
    return polyLookAroundSchema.parse(
      await requestJson<unknown>("/poly/look-around", "PATCH", input),
    );
  }

  async readPolyRoutines(): Promise<PolyRoutines> {
    return polyRoutinesSchema.parse(await requestJson<unknown>("/poly/routines", "GET"));
  }

  async setupPolyRoutine(input: SetupPolyRoutine): Promise<PolyRoutineSetup> {
    return polyRoutineSetupSchema.parse(
      await requestJson<unknown>("/poly/routines", "POST", input),
    );
  }

  async removePolyRoutine(templateId: PolyRoutineTemplateId): Promise<void> {
    await requestJson<unknown>(`/poly/routines/${encodeURIComponent(templateId)}`, "DELETE");
  }

  async grantPolyStandingApproval(interactionId: string): Promise<StandingApproval> {
    return standingApprovalSchema.parse(
      await requestJson<unknown>("/approvals/standing", "POST", { interaction_id: interactionId }),
    );
  }

  async revokePolyStandingApproval(
    toolName: string,
    destination: string,
    contextId?: string,
  ): Promise<void> {
    const query = contextId ? `?context_id=${encodeURIComponent(contextId)}` : "";

    await requestJson<unknown>(
      `/approvals/standing/${encodeURIComponent(standingApprovalId(toolName, destination))}${query}`,
      "DELETE",
    );
  }
}
