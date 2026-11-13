
import { api, APIError } from "encore.dev/api";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import type { Project, Task, TaskPriority, TaskStatus } from "./types";
import { isTaskPriority, isTaskStatus } from "./types";

interface CreateProjectRequest {
  name: string;
  description?: string;
  color?: string;
}

interface UpdateProjectRequest {
  id: string;
  name?: string;
  description?: string;
}

interface CreateTaskRequest {
  title: string;
  description?: string;
  projectId: string;
  priority?: TaskPriority;
  assignee?: string;
  dueDate?: string;
}

interface UpdateTaskRequest {
  id: string;
  title?: string;
  description?: string;
  priority?: TaskPriority;
  assignee?: string;
  dueDate?: string | null;
}

interface UpdateStatusRequest {
  id: string;
  status: TaskStatus;
}

interface ListTasksRequest {
  status?: string;
  projectId?: string;
  q?: string;
}

// HEALTH CHECK
export const health = api(
  { expose: true, method: "GET", path: "/health" },
  async (): Promise<{ status: string; service: string }> => ({
    status: "ok",
    service: "project-task-management-api",
  }),
);

// LIST PROJECTS
export const listProjects = api(
  { expose: true, method: "GET", path: "/projects" },
  async (): Promise<{ projects: Project[] }> => {
    const rows = await db.queryAll<Project>`
      SELECT p.id, p.name, p.description, p.color,
             p.created_at AS "createdAt",
             COUNT(t.id)::int AS "taskCount"
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `;
    return { projects: rows };
  },
);

// CREATE PROJECT
export const createProject = api(
  { expose: true, method: "POST", path: "/projects" },
  async (req: CreateProjectRequest): Promise<Project> => {
    const name = req.name.trim();
    if (!name) throw APIError.invalidArgument("Project name is required");

    const id = `proj-${randomUUID()}`;

    const project = await db.queryRow<Project>`
      INSERT INTO projects (id, name, description, color)
      VALUES (${id}, ${name}, ${req.description ?? ""}, ${req.color ?? "#5B7CFA"})
      RETURNING id, name, description, color,
        created_at AS "createdAt",
        0::int AS "taskCount"
    `;

    if (!project) throw APIError.internal("Could not create project");
    return project;
  },
);

// UPDATE PROJECT
export const updateProject = api(
  { expose: true, method: "PATCH", path: "/projects/:id" },
  async (req: UpdateProjectRequest): Promise<Project> => {
    const name = req.name?.trim();

    if (req.name !== undefined && !name) {
      throw APIError.invalidArgument("Project name is required");
    }

    const project = await db.queryRow<Project>`
      UPDATE projects
      SET
        name = COALESCE(${name ?? null}, name),
        description = COALESCE(${req.description ?? null}, description)
      WHERE id = ${req.id}
      RETURNING id, name, description, color,
        created_at AS "createdAt",
        (SELECT COUNT(*)::int FROM tasks WHERE project_id = projects.id)
          AS "taskCount"
    `;

    if (!project) throw APIError.notFound("Project not found");
    return project;
  },
);

// DELETE PROJECT
export const deleteProject = api(
  { expose: true, method: "DELETE", path: "/projects/:id" },
  async ({ id }: { id: string }): Promise<{ success: boolean }> => {
    const result = await db.queryRow<{ id: string }>`
      DELETE FROM projects
      WHERE id = ${id}
      RETURNING id
    `;

    if (!result) throw APIError.notFound("Project not found");
    return { success: true };
  },
);

// LIST TASKS
export const listTasks = api(
  { expose: true, method: "GET", path: "/tasks" },
  async (req: ListTasksRequest): Promise<{ tasks: Task[] }> => {
    const status = req.status && req.status !== "All" ? req.status : null;
    const projectId = req.projectId || null;
    const q = req.q?.trim() ? `%${req.q.trim()}%` : null;

    const tasks = await db.queryAll<Task>`
      SELECT t.id, t.project_id AS "projectId", p.name AS "projectName",
             t.title, t.description, t.status, t.priority, t.assignee,
             t.due_date::text AS "dueDate",
             t.created_at AS "createdAt", t.updated_at AS "updatedAt"
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE (${status}::text IS NULL OR t.status = ${status})
        AND (${projectId}::text IS NULL OR t.project_id = ${projectId})
        AND (${q}::text IS NULL OR t.title ILIKE ${q} OR t.description ILIKE ${q})
      ORDER BY
        CASE t.priority WHEN 'Urgent' THEN 1 WHEN 'High' THEN 2
          WHEN 'Medium' THEN 3 ELSE 4 END,
        t.due_date ASC NULLS LAST, t.created_at DESC
    `;

    return { tasks };
  },
);

// CREATE TASK
export const createTask = api(
  { expose: true, method: "POST", path: "/tasks" },
  async (req: CreateTaskRequest): Promise<Task> => {
    const title = req.title.trim();
    if (!title) throw APIError.invalidArgument("Task title is required");

    if (req.priority && !isTaskPriority(req.priority)) {
      throw APIError.invalidArgument("Invalid task priority");
    }

    const project = await db.queryRow<{ id: string }>`
      SELECT id FROM projects WHERE id = ${req.projectId}
    `;

    if (!project) throw APIError.notFound("Project not found");

    const id = `task-${randomUUID()}`;

    const task = await db.queryRow<Task>`
      INSERT INTO tasks (id, project_id, title, description, priority, assignee, due_date)
      VALUES (
        ${id}, ${req.projectId}, ${title}, ${req.description ?? ""},
        ${req.priority ?? "Medium"}, ${req.assignee ?? "Unassigned"},
        ${req.dueDate ?? null}::date
      )
      RETURNING id, project_id AS "projectId", title, description, status,
        priority, assignee, due_date::text AS "dueDate",
        created_at AS "createdAt", updated_at AS "updatedAt"
    `;

    if (!task) throw APIError.internal("Could not create task");

    task.projectName = (await db.queryRow<{ name: string }>`
      SELECT name FROM projects WHERE id = ${req.projectId}
    `)?.name;

    return task;
  },
);

// UPDATE TASK STATUS
export const updateTaskStatus = api(
  { expose: true, method: "PATCH", path: "/tasks/:id/status" },
  async (req: UpdateStatusRequest): Promise<Task> => {
    if (!isTaskStatus(req.status)) {
      throw APIError.invalidArgument("Invalid task status");
    }

    const task = await db.queryRow<Task>`
      UPDATE tasks SET status = ${req.status}, updated_at = NOW()
      WHERE id = ${req.id}
      RETURNING id, project_id AS "projectId", title, description, status,
        priority, assignee, due_date::text AS "dueDate",
        created_at AS "createdAt", updated_at AS "updatedAt"
    `;

    if (!task) throw APIError.notFound("Task not found");
    return task;
  },
);

// UPDATE TASK DETAILS
export const updateTask = api(
  { expose: true, method: "PATCH", path: "/tasks/:id" },
  async (req: UpdateTaskRequest): Promise<Task> => {
    if (req.priority && !isTaskPriority(req.priority)) {
      throw APIError.invalidArgument("Invalid task priority");
    }

    const task = await db.queryRow<Task>`
      UPDATE tasks SET
        title = COALESCE(${req.title?.trim() || null}, title),
        description = COALESCE(${req.description ?? null}, description),
        priority = COALESCE(${req.priority ?? null}, priority),
        assignee = COALESCE(${req.assignee ?? null}, assignee),
        due_date = CASE WHEN ${req.dueDate === undefined} THEN due_date
                        ELSE ${req.dueDate ?? null}::date END,
        updated_at = NOW()
      WHERE id = ${req.id}
      RETURNING id, project_id AS "projectId", title, description, status,
        priority, assignee, due_date::text AS "dueDate",
        created_at AS "createdAt", updated_at AS "updatedAt"
    `;

    if (!task) throw APIError.notFound("Task not found");
    return task;
  },
);

// DELETE TASK
export const deleteTask = api(
  { expose: true, method: "DELETE", path: "/tasks/:id" },
  async ({ id }: { id: string }): Promise<{ success: boolean }> => {
    const result = await db.queryRow<{ id: string }>`
      DELETE FROM tasks WHERE id = ${id} RETURNING id
    `;

    if (!result) throw APIError.notFound("Task not found");
    return { success: true };
  },
);

// DASHBOARD
export const dashboard = api(
  { expose: true, method: "GET", path: "/dashboard" },
  async (): Promise<{
    totals: {
      projects: number;
      tasks: number;
      completed: number;
      inProgress: number;
      overdue: number;
    };
    byStatus: { status: string; count: number }[];
    upcoming: Task[];
  }> => {
    const totals = await db.queryRow<{
      projects: number;
      tasks: number;
      completed: number;
      inProgress: number;
      overdue: number;
    }>`
      SELECT
        (SELECT COUNT(*)::int FROM projects) AS projects,
        COUNT(*)::int AS tasks,
        COUNT(*) FILTER (WHERE status = 'Done')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'In Progress')::int AS "inProgress",
        COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status <> 'Done')::int AS overdue
      FROM tasks
    `;

    const byStatus = await db.queryAll<{ status: string; count: number }>`
      SELECT status, COUNT(*)::int AS count FROM tasks GROUP BY status
    `;

    const upcoming = await db.queryAll<Task>`
      SELECT t.id, t.project_id AS "projectId", p.name AS "projectName",
        t.title, t.description, t.status, t.priority, t.assignee,
        t.due_date::text AS "dueDate", t.created_at AS "createdAt",
        t.updated_at AS "updatedAt"
      FROM tasks t JOIN projects p ON p.id = t.project_id
      WHERE t.status <> 'Done'
      ORDER BY t.due_date ASC NULLS LAST LIMIT 6
    `;

    return {
      totals: totals ?? {
        projects: 0,
        tasks: 0,
        completed: 0,
        inProgress: 0,
        overdue: 0,
      },
      byStatus,
      upcoming,
    };
  },
);

// SEED DEMO DATA
export const seed = api(
  { expose: true, method: "POST", path: "/seed" },
  async (): Promise<{ seeded: boolean; message: string }> => {
    const existing = await db.queryRow<{ count: number }>`
      SELECT COUNT(*)::int AS count FROM projects
    `;

    if ((existing?.count ?? 0) > 0) {
      return {
        seeded: false,
        message: "Database already contains project data.",
      };
    }

    await db.exec`
      INSERT INTO projects (id, name, description, color) VALUES
      ('proj-demo-web', 'Website Redesign', 'Refresh the public website and improve conversion.', '#6475F5'),
      ('proj-mobile', 'Mobile App', 'Deliver the first release of the companion mobile app.', '#19A88A'),
      ('proj-platform', 'Platform Modernization', 'Improve reliability, performance and developer experience.', '#D68B3C')
    `;

    await db.exec`
      INSERT INTO tasks (id, project_id, title, description, status, priority, assignee, due_date) VALUES
      ('task-101', 'proj-demo-web', 'Create homepage wireframes', 'Prepare responsive homepage layouts for review.', 'Done', 'High', 'Alex Morgan', CURRENT_DATE - INTERVAL '2 days'),
      ('task-102', 'proj-demo-web', 'Build navigation component', 'Implement desktop and mobile navigation.', 'In Progress', 'Urgent', 'Jamie Chen', CURRENT_DATE + INTERVAL '2 days'),
      ('task-103', 'proj-demo-web', 'Review accessibility', 'Run keyboard and contrast checks.', 'Todo', 'Medium', 'Taylor Smith', CURRENT_DATE + INTERVAL '5 days'),
      ('task-104', 'proj-mobile', 'Set up app foundation', 'Configure navigation and shared theme.', 'Done', 'High', 'Jordan Lee', CURRENT_DATE - INTERVAL '1 day'),
      ('task-105', 'proj-mobile', 'Implement profile screen', 'Build profile details and edit states.', 'In Review', 'Medium', 'Alex Morgan', CURRENT_DATE + INTERVAL '3 days'),
      ('task-106', 'proj-platform', 'Document API standards', 'Publish endpoint and error response conventions.', 'Todo', 'Low', 'Morgan Patel', CURRENT_DATE + INTERVAL '8 days'),
      ('task-107', 'proj-platform', 'Add service health checks', 'Expose health endpoints for core services.', 'In Progress', 'High', 'Jamie Chen', CURRENT_DATE + INTERVAL '1 day')
    `;

    return { seeded: true, message: "Demo projects and tasks created." };
  },
);
