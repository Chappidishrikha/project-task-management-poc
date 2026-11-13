export type TaskStatus = "Todo" | "In Progress" | "In Review" | "Done";
export type TaskPriority = "Low" | "Medium" | "High" | "Urgent";

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: string;
  taskCount: number;
}

export interface Task {
  id: string;
  projectId: string;
  projectName?: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export const statuses: TaskStatus[] = ["Todo", "In Progress", "In Review", "Done"];
export const priorities: TaskPriority[] = ["Low", "Medium", "High", "Urgent"];

export function isTaskStatus(value: string): value is TaskStatus {
  return statuses.includes(value as TaskStatus);
}

export function isTaskPriority(value: string): value is TaskPriority {
  return priorities.includes(value as TaskPriority);
}
