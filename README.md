# Project & Task Management System — Complete POC

A full-stack project/task management POC using the stack requested in the supplied screenshots.

## Included functionality

- Dashboard with project/task totals, completion rate, status distribution and upcoming tasks
- Project creation and project list
- Task creation, listing, filtering and search
- Task status changes: Todo → In Progress → In Review → Done
- Priority levels: Low, Medium, High, Urgent
- Due dates, assignees and project association
- Delete tasks
- Persistent PostgreSQL storage provisioned by Encore.ts
- SQL migration and repeatable demo-data seed endpoint
- Vitest unit test and Playwright browser smoke test
- Next.js rewrite proxy so the browser calls `/api/*` without direct cross-origin requests

> This is a development POC. The demo seed endpoint and APIs are intentionally unauthenticated. Add authentication, authorization, audit logging, rate limits and production secrets before exposing it publicly.

## Stack

- Next.js App Router, React, TypeScript
- Tailwind CSS v4
- shadcn/ui-compatible component setup using Radix UI primitives
- lucide-react
- Encore.ts backend
- Encore-managed PostgreSQL
- pnpm workspace
- Vitest + React Testing Library dependencies
- Playwright

The versions shown in the supplied screenshots are pinned where possible. The screenshot's Next.js/React versions are retained as requested; if your package registry does not resolve a version, check the package release page and use the nearest compatible stable release rather than changing the framework.

## Requirements

- macOS (Apple Silicon or Intel)
- Node.js 22
- pnpm 12.10.1
- Encore CLI
- Docker Desktop running (Encore uses local containers for its managed PostgreSQL development environment)

## Installation

### 1. Extract the ZIP

Extract `project-task-management-poc.zip`, then open the extracted folder in VS Code.

### 2. Check tools

```bash
node --version
pnpm --version
encore version
docker --version
docker info
```

Use Node 22 and pnpm 12.10.1. If pnpm is not installed:

```bash
corepack enable
corepack prepare pnpm@12.10.1 --activate
```

Install Encore on macOS if needed:

```bash
brew install encoredev/tap/encore
```

Start Docker Desktop and wait until its engine is running before starting Encore.

### 3. Install dependencies

From the project root:

```bash
pnpm install
```

### 4. Start the Encore backend

Open Terminal 1:

```bash
cd backend
encore run
```

Encore will compile the backend, start its local infrastructure and apply the SQL migrations. The API is normally available at:

- API: http://localhost:4000
- Encore development dashboard: http://localhost:9400

Keep this terminal running.

### 5. Start the Next.js frontend

Open Terminal 2, from the project root:

```bash
pnpm --filter frontend dev
```

Open http://localhost:3000.

The frontend proxies `/api/*` requests to `http://localhost:4000`. To change the backend address, copy `frontend/.env.example` to `frontend/.env.local` and update `ENCORE_API_URL`.

### 6. Load sample data

In a browser or a third terminal:

```bash
curl -X POST http://localhost:4000/seed
```

Refresh the frontend. The seed endpoint is safe to call more than once: it only inserts the demo dataset when the database is empty.

### 7. Test the APIs

```bash
curl http://localhost:4000/health
curl http://localhost:4000/dashboard
curl http://localhost:4000/projects
curl http://localhost:4000/tasks
```

Create a task:

```bash
curl -X POST http://localhost:4000/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Prepare POC walkthrough",
    "description": "Demonstrate the task workflow",
    "projectId": "proj-demo-web",
    "priority": "High",
    "assignee": "Alex Morgan",
    "dueDate": "2026-12-01"
  }'
```

### 8. Run tests

From the project root:

```bash
pnpm test
```

Run the Playwright smoke test after both servers are running:

```bash
pnpm test:e2e
```

Install the Playwright browser once if prompted:

```bash
pnpm --filter frontend exec playwright install chromium
```

## Useful commands

| Purpose | Command |
|---|---|
| Install packages | `pnpm install` |
| Frontend dev server | `pnpm --filter frontend dev` |
| Frontend production build | `pnpm --filter frontend build` |
| Backend dev server | `cd backend && encore run` |
| Unit tests | `pnpm test` |
| E2E test | `pnpm test:e2e` |

## API reference

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/dashboard` | Dashboard summary |
| GET | `/projects` | List projects with task counts |
| POST | `/projects` | Create project |
| GET | `/tasks` | List tasks; optional `status`, `projectId`, `q` query parameters |
| POST | `/tasks` | Create task |
| PATCH | `/tasks/:id` | Update task fields |
| PATCH | `/tasks/:id/status` | Change task status |
| DELETE | `/tasks/:id` | Delete task |
| POST | `/seed` | Insert demo data if database is empty |

## Troubleshooting

### Encore cannot start PostgreSQL

1. Open Docker Desktop.
2. Wait for the engine to finish starting.
3. Run `docker info` and confirm it returns server information.
4. Retry `encore run`.

### Frontend shows “Unable to load data”

1. Confirm the Encore terminal says the API is running.
2. Test `curl http://localhost:4000/health`.
3. Confirm `frontend/.env.local` uses `ENCORE_API_URL=http://localhost:4000` if you created that file.
4. Restart the Next.js dev server after changing environment variables.

### Port already in use

Stop the process already using port 3000 or 4000, or change the frontend port with:

```bash
pnpm --filter frontend dev -- --port 3001
```

If the backend port changes, update `ENCORE_API_URL` in `frontend/.env.local`.

## Notes

- Encore's local PostgreSQL is managed by Encore; do not create a separate PostgreSQL database for this POC.
- The database migration is in `backend/tasks/migrations/001_create_project_task_tables.up.sql`.
- Demo records are illustrative and can be deleted from the UI.
- No cloud deployment is configured. The POC runs locally.
