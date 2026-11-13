export type TaskStatus = "Todo" | "In Progress" | "In Review" | "Done";
export type TaskPriority = "Low" | "Medium" | "High" | "Urgent";

export interface Project {
  id: string; name: string; description: string; color: string; taskCount: number;
}
export interface Task {
  id: string; projectId: string; projectName?: string; title: string;
  description: string; status: TaskStatus; priority: TaskPriority;
  assignee: string; dueDate: string | null;
}
export interface DashboardData {
  totals: { projects: number; tasks: number; completed: number; inProgress: number; overdue: number };
  byStatus: { status: string; count: number }[];
  upcoming: Task[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  dashboard: () => request<DashboardData>("/dashboard"),
  projects: () => request<{ projects: Project[] }>("/projects"),
  tasks: (params = "") => request<{ tasks: Task[] }>(`/tasks${params ? `?${params}` : ""}`),
  createProject: (data: { name: string; description: string }) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify(data) }),
  updateProject: (id: string, data: { name?: string; description?: string }) =>
  request<Project>(`/projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }),

deleteProject: (id: string) =>
  request<{ success: boolean }>(`/projects/${encodeURIComponent(id)}`, {
    method: "DELETE",
  }),
  createTask: (data: {
    title: string; description: string; projectId: string; priority: TaskPriority;
    assignee: string; dueDate: string;
  }) => request<Task>("/tasks", { method: "POST", body: JSON.stringify(data) }),
  updateStatus: (id: string, status: TaskStatus) =>
    request<Task>(`/tasks/${encodeURIComponent(id)}/status`, {
      method: "PATCH", body: JSON.stringify({ status }),
    }),
  deleteTask: (id: string) =>
    request<{ success: boolean }>(`/tasks/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
