import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  Task,
  TaskPriority,
  TaskSource,
  TaskStatus,
  TaskType,
} from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v && typeof (v as { toDate?: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate();
  }
  return new Date();
}

function mapTask(id: string, data: Record<string, unknown>): Task {
  return {
    id,
    orgId: data.orgId as string,
    patientId: data.patientId as string,
    assignedTo: data.assignedTo as string | undefined,
    assignedBy: data.assignedBy as string,
    type: data.type as TaskType,
    priority: data.priority as TaskPriority,
    status: data.status as TaskStatus,
    source: data.source as TaskSource,
    title: data.title as string,
    description: data.description as string | undefined,
    context: data.context as Task["context"],
    dueAt: data.dueAt ? toDate(data.dueAt) : undefined,
    completedAt: data.completedAt ? toDate(data.completedAt) : undefined,
    completedBy: data.completedBy as string | undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

class TaskService {
  private tasksCol() {
    return collection(db, "tasks");
  }

  // ─── Create ────────────────────────────────────────────────────────────────

  /**
   * Create a new task.
   */
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
    const now = new Date();
    const ref = await addDoc(this.tasksCol(), {
      orgId: params.orgId,
      patientId: params.patientId,
      assignedBy: params.assignedBy,
      assignedTo: params.assignedTo ?? null,
      type: params.type,
      priority: params.priority,
      source: params.source,
      status: "open",
      title: params.title,
      description: params.description ?? null,
      context: params.context ?? null,
      dueAt: params.dueAt ?? null,
      completedAt: null,
      completedBy: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      id: ref.id,
      orgId: params.orgId,
      patientId: params.patientId,
      assignedBy: params.assignedBy,
      assignedTo: params.assignedTo,
      type: params.type,
      priority: params.priority,
      source: params.source,
      status: "open",
      title: params.title,
      description: params.description,
      context: params.context,
      dueAt: params.dueAt,
      createdAt: now,
      updatedAt: now,
    };
  }

  // ─── Queries ───────────────────────────────────────────────────────────────

  /**
   * List tasks for an organization, with optional filters.
   */
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
    const { status = "all", assignedTo, priority, patientId, maxResults = 50 } =
      filters;

    let q = query(this.tasksCol(), where("orgId", "==", orgId));

    if (status !== "all") {
      q = query(q, where("status", "==", status));
    }

    if (assignedTo) {
      q = query(q, where("assignedTo", "==", assignedTo));
    }

    if (priority) {
      q = query(q, where("priority", "==", priority));
    }

    if (patientId) {
      q = query(q, where("patientId", "==", patientId));
    }

    q = query(q, orderBy("createdAt", "desc"), limit(maxResults));

    const snap = await getDocs(q);
    return snap.docs.map((d) => mapTask(d.id, d.data()));
  }

  /**
   * List open tasks assigned to a specific user (coordinator/provider queue).
   */
  async listMyTasks(orgId: string, userId: string): Promise<Task[]> {
    const q = query(
      this.tasksCol(),
      where("orgId", "==", orgId),
      where("assignedTo", "==", userId),
      where("status", "in", ["open", "in_progress"]),
      orderBy("createdAt", "desc"),
      limit(100)
    );

    const snap = await getDocs(q);
    return snap.docs.map((d) => mapTask(d.id, d.data()));
  }

  /**
   * List urgent/overdue tasks for the org (for dashboard priority indicators).
   */
  async listUrgentTasks(orgId: string): Promise<Task[]> {
    const q = query(
      this.tasksCol(),
      where("orgId", "==", orgId),
      where("priority", "==", "urgent"),
      where("status", "in", ["open", "in_progress"]),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const snap = await getDocs(q);
    return snap.docs.map((d) => mapTask(d.id, d.data()));
  }

  // ─── Updates ───────────────────────────────────────────────────────────────

  /**
   * Update task status. Pass completedBy when marking as completed.
   */
  async updateStatus(
    taskId: string,
    status: TaskStatus,
    completedBy?: string
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      status,
      updatedAt: serverTimestamp(),
    };

    if (status === "completed" && completedBy) {
      updates.completedAt = serverTimestamp();
      updates.completedBy = completedBy;
    }

    await updateDoc(doc(this.tasksCol(), taskId), updates);
  }

  /**
   * Assign a task to a care team member.
   */
  async assignTask(taskId: string, assignedTo: string): Promise<void> {
    await updateDoc(doc(this.tasksCol(), taskId), {
      assignedTo,
      status: "in_progress",
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * Escalate a task (e.g., when SLA is breached).
   */
  async escalateTask(taskId: string, reason: string): Promise<void> {
    await updateDoc(doc(this.tasksCol(), taskId), {
      status: "escalated",
      "context.escalationReason": reason,
      priority: "urgent",
      updatedAt: serverTimestamp(),
    });
  }
}

export const taskService = new TaskService();
