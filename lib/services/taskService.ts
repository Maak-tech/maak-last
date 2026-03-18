/**
 * Task Service — Firebase-free replacement.
 *
 * REST API endpoints:
 *   POST  /api/tasks               → createTask
 *   GET   /api/tasks?orgId=&...    → listOrgTasks / listMyTasks / listUrgentTasks
 *   PATCH /api/tasks/:id/status    → updateStatus
 *   PATCH /api/tasks/:id/assign    → assignTask
 *   PATCH /api/tasks/:id/escalate  → escalateTask
 */
import { api } from "@/lib/apiClient";
import type { Task, TaskPriority, TaskSource, TaskStatus, TaskType } from "@/types";

function normalizeTask(raw: Record<string, unknown>): Task {
  return {
    id: raw.id as string,
    orgId: raw.orgId as string,
    patientId: raw.patientId as string,
    assignedTo: raw.assignedTo as string | undefined,
    assignedBy: raw.assignedBy as string,
    type: raw.type as TaskType,
    priority: raw.priority as TaskPriority,
    status: raw.status as TaskStatus,
    source: raw.source as TaskSource,
    title: raw.title as string,
    description: raw.description as string | undefined,
    context: raw.context as Task["context"],
    dueAt: raw.dueAt ? new Date(raw.dueAt as string) : undefined,
    completedAt: raw.completedAt ? new Date(raw.completedAt as string) : undefined,
    completedBy: raw.completedBy as string | undefined,
    createdAt: raw.createdAt ? new Date(raw.createdAt as string) : new Date(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt as string) : new Date(),
  };
}

class TaskService {
  async createTask(params: {
    orgId: string;
    patientId: string;
    assignedBy: string;
    type: TaskType;
    priority: TaskPriority;
    source: TaskSource;
    title: string;
    description?: string;
    assignedTo?: string;
    dueAt?: Date;
    context?: Task["context"];
  }): Promise<Task> {
    const raw = await api.post<Record<string, unknown>>("/api/tasks", {
      orgId: params.orgId,
      patientId: params.patientId,
      assignedBy: params.assignedBy,
      assignedTo: params.assignedTo,
      type: params.type,
      priority: params.priority,
      source: params.source,
      title: params.title,
      description: params.description,
      context: params.context,
      dueAt: params.dueAt?.toISOString(),
    });
    return normalizeTask(raw);
  }

  async listOrgTasks(
    orgId: string,
    filters: {
      status?: TaskStatus | "all";
      assignedTo?: string;
      priority?: TaskPriority;
      patientId?: string;
      maxResults?: number;
    } = {}
  ): Promise<Task[]> {
    const params = new URLSearchParams({ orgId });
    if (filters.status && filters.status !== "all") params.set("status", filters.status);
    if (filters.assignedTo) params.set("assignedTo", filters.assignedTo);
    if (filters.priority) params.set("priority", filters.priority);
    if (filters.patientId) params.set("patientId", filters.patientId);
    if (filters.maxResults) params.set("limit", String(filters.maxResults));
    const raw = await api.get<Record<string, unknown>[]>(`/api/tasks?${params.toString()}`);
    return (raw ?? []).map(normalizeTask);
  }

  async listMyTasks(orgId: string, userId: string): Promise<Task[]> {
    return this.listOrgTasks(orgId, { assignedTo: userId, status: "open" as TaskStatus });
  }

  async listUrgentTasks(orgId: string): Promise<Task[]> {
    return this.listOrgTasks(orgId, { priority: "urgent" as TaskPriority, status: "open" as TaskStatus, maxResults: 20 });
  }

  async updateStatus(
    taskId: string,
    status: TaskStatus,
    completedBy?: string
  ): Promise<void> {
    await api.patch(`/api/tasks/${taskId}/status`, { status, completedBy });
  }

  async assignTask(taskId: string, assignedTo: string): Promise<void> {
    await api.patch(`/api/tasks/${taskId}/assign`, { assignedTo });
  }

  async escalateTask(taskId: string, reason: string): Promise<void> {
    await api.patch(`/api/tasks/${taskId}/escalate`, {
      context: { escalationReason: reason },
    });
  }
}

export const taskService = new TaskService();
