import { useCallback, useEffect, useRef, useState } from "react";
import { taskService } from "@/lib/services/taskService";
import type { Task, TaskPriority, TaskStatus } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type UseTasksOptions = {
  orgId: string | null | undefined;
  /** Filter to tasks assigned to this user. Omit for all org tasks. */
  userId?: string;
  /** Initial status filter. Default "all". */
  initialStatus?: TaskStatus | "all";
  autoLoad?: boolean;
};

type UseTasksReturn = {
  tasks: Task[];
  urgentCount: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  statusFilter: TaskStatus | "all";
  setStatusFilter: (s: TaskStatus | "all") => void;
  refresh: () => Promise<void>;
  completeTask: (taskId: string, completedBy: string) => Promise<void>;
  assignTask: (taskId: string, assignedTo: string) => Promise<void>;
  escalateTask: (taskId: string, reason: string) => Promise<void>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTasks(options: UseTasksOptions): UseTasksReturn {
  const { orgId, userId, initialStatus = "all", autoLoad = true } = options;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">(
    initialStatus
  );

  const isMountedRef = useRef(true);

  // ─── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(
    async (isRefresh = false) => {
      if (!orgId) return;

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        let fetched: Task[];

        if (userId) {
          // My task queue (for a specific coordinator/provider)
          fetched = await taskService.listMyTasks(orgId, userId);
        } else {
          // All org tasks with status filter
          fetched = await taskService.listOrgTasks(orgId, {
            status: statusFilter,
            maxResults: 100,
          });
        }

        if (isMountedRef.current) {
          setTasks(fetched);
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : "Failed to load tasks");
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [orgId, userId, statusFilter]
  );

  const refresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    if (autoLoad && orgId) load(false);
  }, [autoLoad, orgId, load]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const completeTask = useCallback(
    async (taskId: string, completedBy: string) => {
      await taskService.updateStatus(taskId, "completed", completedBy);
      if (isMountedRef.current) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: "completed",
                  completedAt: new Date(),
                  completedBy,
                }
              : t
          )
        );
      }
    },
    []
  );

  const assignTask = useCallback(async (taskId: string, assignedTo: string) => {
    await taskService.assignTask(taskId, assignedTo);
    if (isMountedRef.current) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, assignedTo, status: "in_progress" } : t
        )
      );
    }
  }, []);

  const escalateTask = useCallback(async (taskId: string, reason: string) => {
    await taskService.escalateTask(taskId, reason);
    if (isMountedRef.current) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: "escalated", priority: "urgent" as TaskPriority }
            : t
        )
      );
    }
  }, []);

  // ─── Derived ────────────────────────────────────────────────────────────────

  const urgentCount = tasks.filter(
    (t) =>
      t.priority === "urgent" &&
      t.status !== "completed" &&
      t.status !== "cancelled"
  ).length;

  return {
    tasks,
    urgentCount,
    loading,
    refreshing,
    error,
    statusFilter,
    setStatusFilter,
    refresh,
    completeTask,
    assignTask,
    escalateTask,
  };
}
