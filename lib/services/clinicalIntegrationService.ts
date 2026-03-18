import { api } from "@/lib/apiClient";
import type {
  ClinicalIntegrationRequest,
  ClinicalIntegrationStatus,
  ClinicalIntegrationType,
} from "@/types";

class ClinicalIntegrationService {
  async createIntegrationRequest(
    userId: string,
    data: {
      type: ClinicalIntegrationType;
      providerName: string;
      portalUrl?: string;
      patientId?: string;
      notes?: string;
      status?: ClinicalIntegrationStatus;
    }
  ): Promise<string> {
    const providerName = data.providerName?.trim();
    if (!providerName) {
      throw new Error("Provider name is required");
    }

    const requestData: Record<string, unknown> = {
      providerName,
      status: data.status || "pending",
      createdAt: new Date().toISOString(),
    };

    if (data.portalUrl?.trim()) requestData.portalUrl = data.portalUrl.trim();
    if (data.notes?.trim()) requestData.notes = data.notes.trim();

    const payload: Record<string, unknown> = {
      orgId: userId,  // use userId as orgId for personal integration requests
      integrationType: data.type,
      patientId: data.patientId?.trim() || userId,
      requestData,
    };

    const result = await api.post<{ id: string }>(
      "/api/clinical/integration-requests",
      payload
    );
    return result?.id ?? "";
  }

  async getIntegrationRequests(
    userId: string,
    type?: ClinicalIntegrationType
  ): Promise<ClinicalIntegrationRequest[]> {
    try {
      const typeParam = type ? `&integrationType=${encodeURIComponent(type)}` : "";
      const result = await api.get<ClinicalIntegrationRequest[]>(
        `/api/clinical/integration-requests?patientId=${userId}${typeParam}`
      );
      const requests = Array.isArray(result) ? result : [];
      return requests.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch {
      return [];
    }
  }

  async getLatestIntegrationRequest(
    userId: string,
    type: ClinicalIntegrationType
  ): Promise<ClinicalIntegrationRequest | null> {
    const requests = await this.getIntegrationRequests(userId, type);
    return requests[0] || null;
  }
}

export const clinicalIntegrationService = new ClinicalIntegrationService();
