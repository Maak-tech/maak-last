import {
  addDoc,
  collection,
  getDocs,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  ClinicalIntegrationRequest,
  ClinicalIntegrationStatus,
  ClinicalIntegrationType,
} from "@/types";

const REQUESTS_COLLECTION = "clinicalIntegrationRequests";

const mapRequest = (
  requestId: string,
  data: Record<string, unknown>
): ClinicalIntegrationRequest => {
  const createdAt =
    data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date();
  const updatedAt =
    data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : createdAt;

  return {
    id: requestId,
    userId: String(data.userId || ""),
    type: data.type as ClinicalIntegrationType,
    providerName: String(data.providerName || ""),
    portalUrl: typeof data.portalUrl === "string" ? data.portalUrl : undefined,
    patientId: typeof data.patientId === "string" ? data.patientId : undefined,
    notes: typeof data.notes === "string" ? data.notes : undefined,
    status: (data.status as ClinicalIntegrationStatus) || "pending",
    createdAt,
    updatedAt,
  };
};

class ClinicalIntegrationService {
  private getCollectionRef(userId: string) {
    return collection(db, "users", userId, REQUESTS_COLLECTION);
  }

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

    const payload = Object.fromEntries(
      Object.entries({
        userId,
        type: data.type,
        providerName,
        portalUrl: data.portalUrl?.trim() || undefined,
        patientId: data.patientId?.trim() || undefined,
        notes: data.notes?.trim() || undefined,
        status: data.status || "pending",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }).filter(([_, value]) => value !== undefined)
    );

    const docRef = await addDoc(this.getCollectionRef(userId), payload);
    return docRef.id;
  }

  async getIntegrationRequests(
    userId: string,
    type?: ClinicalIntegrationType
  ): Promise<ClinicalIntegrationRequest[]> {
    const collectionRef = this.getCollectionRef(userId);
    const requestQuery = type
      ? query(collectionRef, where("type", "==", type))
      : collectionRef;
    const snapshot = await getDocs(requestQuery);
    const requests = snapshot.docs.map((docSnap) =>
      mapRequest(docSnap.id, docSnap.data())
    );

    return requests.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
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
