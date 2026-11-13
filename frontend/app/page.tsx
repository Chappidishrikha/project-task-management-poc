"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDown, ArrowUpRight, Bell, CalendarDays, Check, CheckCircle2,
  ChevronDown, Circle, Clock3, FolderKanban, LayoutDashboard, ListTodo,
  MoreHorizontal, Plus, Search, SlidersHorizontal, Sparkles, Trash2, Users,
  X, Zap,
} from "lucide-react";
import { api, type DashboardData, type Project, type Task, type TaskPriority, type TaskStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from "@/components/ui/dialog";

const statusOptions: TaskStatus[] = ["Todo", "In Progress", "In Review", "Done"];
const priorityOptions: TaskPriority[] = ["Low", "Medium", "High", "Urgent"];

function StatusPill({ status }: { status: TaskStatus }) {
  const styles: Record<TaskStatus, string> = {
    "Todo": "bg-slate-100 text-slate-600",
    "In Progress": "bg-blue-50 text-blue-700",
    "In Review": "bg-amber-50 text-amber-700",
    "Done": "bg-emerald-50 text-emerald-700",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>{status}</span>;
}
function PriorityMark({ priority }: { priority: TaskPriority }) {
  const colors: Record<TaskPriority, string> = {
    Low: "text-slate-400", Medium: "text-blue-500", High: "text-orange-500", Urgent: "text-rose-600",
  };
  return <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${colors[priority]}`}><Zap size={13}/>{priority}</span>;
}
function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}
function dateLabel(value: string | null) {
  if (!value) return "No due date";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Home() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeView, setActiveView] = useState<"Overview" | "My Tasks" | "Projects">("Overview");
  const [statusFilter, setStatusFilter] = useState("All");
  const [projectFilter, setProjectFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [taskDialog, setTaskDialog] = useState(false);
  const [projectDialog, setProjectDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "", description: "", projectId: "", priority: "Medium" as TaskPriority,
    assignee: "Alex Morgan", dueDate: "",
  });
  const [projectForm, setProjectForm] = useState({ name: "", description: "" });
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editProjectForm, setEditProjectForm] = useState({
  name: "",
  description: "",
});
  const [openProjectMenu, setOpenProjectMenu] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError("");
    try {
      const [d, p, t] = await Promise.all([api.dashboard(), api.projects(), api.tasks()]);
      setDashboard(d); setProjects(p.projects); setTasks(t.tasks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load data");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const matchesStatus = statusFilter === "All" || task.status === statusFilter;
    const matchesProject = projectFilter === "All" || task.projectId === projectFilter;
    const query = search.toLowerCase();
    const matchesSearch = !query || `${task.title} ${task.projectName ?? ""} ${task.assignee}`.toLowerCase().includes(query);
    return matchesStatus && matchesProject && matchesSearch;
  }), [tasks, statusFilter, projectFilter, search]);

  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    try {
      await api.createTask({ ...taskForm, dueDate: taskForm.dueDate });
      setTaskDialog(false);
      setTaskForm({ title: "", description: "", projectId: projects[0]?.id ?? "", priority: "Medium", assignee: "Alex Morgan", dueDate: "" });
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create task"); }
    finally { setSaving(false); }
  }

  async function createProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    try {
      await api.createProject(projectForm);
      setProjectDialog(false); setProjectForm({ name: "", description: "" });
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create project"); }
    finally { setSaving(false); }
  }

  async function updateProject(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (!editingProject) return;

  setSaving(true);
  try {
    await api.updateProject(editingProject.id, editProjectForm);
    setEditingProject(null);
    setEditProjectForm({ name: "", description: "" });
    await refresh();
  } catch (e) {
    setError(e instanceof Error ? e.message : "Could not update project");
  } finally {
    setSaving(false);
  }
}

async function removeProject(project: Project) {
  const confirmed = window.confirm(
    `Delete "${project.name}"? All tasks associated with this project will also be deleted.`
  );

  if (!confirmed) return;

  try {
    await api.deleteProject(project.id);
    setOpenProjectMenu(null);
    if (projectFilter === project.id) {
      setProjectFilter("All");
    }
    await refresh();
  } catch (e) {
    setError(e instanceof Error ? e.message : "Could not delete project");
  }
}

  async function changeStatus(task: Task, status: TaskStatus) {
    try { await api.updateStatus(task.id, status); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update task"); }
  }

  async function removeTask(task: Task) {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    try { await api.deleteTask(task.id); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not delete task"); }
  }

  const total = dashboard?.totals.tasks ?? 0;
  const completion = total ? Math.round(((dashboard?.totals.completed ?? 0) / total) * 100) : 0;

  return (
    <div className="min-h-screen">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-5 py-6 lg:flex">
          <div className="mb-10 flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white"><Sparkles size={21}/></div>
            <div><div className="text-lg font-bold tracking-tight text-slate-900">flowboard</div><div className="text-xs text-slate-400">Workspace</div></div>
          </div>
          <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Workspace</div>
          <nav className="space-y-1">
            {[
              { label: "Overview", icon: LayoutDashboard },
              { label: "My Tasks", icon: ListTodo },
              { label: "Projects", icon: FolderKanban },
            ].map(({ label, icon: Icon }) => (
              <button key={label} onClick={() => setActiveView(label as typeof activeView)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${activeView === label ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}>
                <Icon size={18}/>{label}
                {label === "My Tasks" && <span className="ml-auto rounded-md bg-slate-100 px-2 py-0.5 text-[10px]">{tasks.length}</span>}
              </button>
            ))}
          </nav>
          <div className="mb-3 mt-9 flex items-center justify-between px-3">
            <span className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Your projects</span>
            <button onClick={() => setProjectDialog(true)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"><Plus size={15}/></button>
          </div>
          <div className="space-y-1">
            {projects.map((project) => (
              <button key={project.id} onClick={() => { setActiveView("Projects"); setProjectFilter(project.id); }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${projectFilter === project.id ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50"}`}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.color }}/><span className="truncate">{project.name}</span>
              </button>
            ))}
          </div>
          <div className="mt-auto rounded-2xl bg-slate-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800"><Zap size={15} className="text-indigo-600"/>Keep momentum</div>
            <p className="text-xs leading-5 text-slate-500">Small, consistent steps make great projects happen.</p>
          </div>
          <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">AM</div>
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-800">Alex Morgan</div><div className="text-xs text-slate-400">Product team</div></div>
            <MoreHorizontal size={18} className="text-slate-400"/>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-slate-200 bg-white/90 px-5 backdrop-blur md:px-9">
            <div>
              <div className="text-xs font-medium text-slate-400">Workspace / {activeView}</div>
              <h1 className="mt-0.5 text-lg font-bold tracking-tight text-slate-900">{activeView === "Overview" ? "Good morning, Alex" : activeView}</h1>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:flex"><Search size={15} className="text-slate-400"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks..." className="w-36 bg-transparent text-xs outline-none placeholder:text-slate-400"/></div>
              <button className="relative rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50"><Bell size={17}/><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-500"/></button>
              <Button onClick={() => { setTaskForm((f) => ({ ...f, projectId: projects[0]?.id ?? "" })); setTaskDialog(true); }}><Plus size={16}/>New task</Button>
            </div>
          </header>

          <div className="mx-auto max-w-[1440px] px-5 py-7 md:px-9 md:py-9">
            {error && <div className="mb-5 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><span>{error}</span><button onClick={() => setError("")}><X size={16}/></button></div>}
            {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Loading your workspace…</div> : (
              <>
                {activeView === "Overview" && <>
                  <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
                    <div><div className="text-sm text-slate-500">Here&apos;s what&apos;s happening across your workspace.</div><h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Your overview</h2></div>
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500"><CalendarDays size={14}/> This month <ChevronDown size={13}/></div>
                  </div>
                  <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      { label: "Total projects", value: dashboard?.totals.projects ?? 0, note: "Active workspaces", icon: FolderKanban, tint: "bg-indigo-50 text-indigo-600" },
                      { label: "Total tasks", value: total, note: "Across all projects", icon: ListTodo, tint: "bg-blue-50 text-blue-600" },
                      { label: "In progress", value: dashboard?.totals.inProgress ?? 0, note: "Currently moving", icon: Activity, tint: "bg-amber-50 text-amber-600" },
                      { label: "Overdue tasks", value: dashboard?.totals.overdue ?? 0, note: "Need your attention", icon: Clock3, tint: "bg-rose-50 text-rose-600" },
                    ].map((item) => <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,.02)]">
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-500">{item.label}</span><span className={`rounded-xl p-2.5 ${item.tint}`}><item.icon size={18}/></span></div>
                      <div className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{item.value}</div><div className="mt-1 text-xs text-slate-400">{item.note}</div>
                    </div>)}
                  </section>

                  <section className="mt-6 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
                      <div className="flex items-center justify-between"><div><h3 className="font-bold text-slate-900">Task progress</h3><p className="mt-1 text-xs text-slate-400">Completion across all projects</p></div><span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-sm font-bold text-emerald-700">{completion}%</span></div>
                      <div className="mt-7 flex items-end justify-between"><div><div className="text-4xl font-bold tracking-tight text-slate-900">{dashboard?.totals.completed ?? 0}<span className="ml-1 text-lg font-medium text-slate-400">/ {total}</span></div><div className="mt-1 text-xs text-slate-400">Tasks completed</div></div><div className="text-xs font-semibold text-emerald-600"><CheckCircle2 size={14} className="mr-1 inline"/>On your way</div></div>
                      <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${completion}%` }}/></div>
                      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{statusOptions.map((status) => {
                        const count = dashboard?.byStatus.find((s) => s.status === status)?.count ?? 0;
                        return <div key={status} className="rounded-xl bg-slate-50 p-3"><div className="text-xl font-bold text-slate-800">{count}</div><div className="mt-1 text-[11px] text-slate-500">{status}</div></div>;
                      })}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
                      <div className="flex items-center justify-between"><div><h3 className="font-bold text-slate-900">Your projects</h3><p className="mt-1 text-xs text-slate-400">A quick look at active work</p></div><button onClick={() => setActiveView("Projects")} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">View all</button></div>
                      <div className="mt-4 space-y-4">{projects.slice(0, 4).map((project) => <div key={project.id}><div className="mb-2 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color }}/><span className="truncate text-sm font-semibold text-slate-700">{project.name}</span></div><span className="text-xs text-slate-400">{project.taskCount} tasks</span></div><div className="h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full" style={{ backgroundColor: project.color, width: `${Math.min(100, project.taskCount * 14)}%` }}/></div></div>)}</div>
                    </div>
                  </section>

                  <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
                    <div className="mb-5 flex items-center justify-between"><div><h3 className="font-bold text-slate-900">Upcoming tasks</h3><p className="mt-1 text-xs text-slate-400">Keep an eye on what&apos;s next</p></div><button onClick={() => setActiveView("My Tasks")} className="text-xs font-semibold text-indigo-600">View all tasks <ArrowUpRight size={13} className="ml-1 inline"/></button></div>
                    <TaskTable tasks={dashboard?.upcoming ?? []} onStatus={changeStatus} onDelete={removeTask}/>
                  </section>
                </>}

                {activeView === "My Tasks" && <>
                  <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-slate-500">Plan, prioritize and keep work moving.</p><h2 className="mt-1 text-2xl font-bold text-slate-900">All tasks</h2></div><Button onClick={() => setTaskDialog(true)}><Plus size={16}/>Add task</Button></div>
                  <div className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center gap-2 px-2 text-xs text-slate-400"><SlidersHorizontal size={14}/> Filters</div>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none"><option>All</option>{statusOptions.map((s) => <option key={s}>{s}</option>)}</select>
                    <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="max-w-48 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none"><option value="All">All projects</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                    <div className="ml-auto flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"><Search size={14} className="text-slate-400"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks" className="w-32 text-xs outline-none"/></div>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><TaskTable tasks={filteredTasks} onStatus={changeStatus} onDelete={removeTask}/></div>
                </>}

                {activeView === "Projects" && <>
                  <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-slate-500">Everything your team is working on.</p><h2 className="mt-1 text-2xl font-bold text-slate-900">Projects</h2></div><Button onClick={() => setProjectDialog(true)}><Plus size={16}/>New project</Button></div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projects.map((project) => {
                    const projectTasks = tasks.filter((t) => t.projectId === project.id);
                    const done = projectTasks.filter((t) => t.status === "Done").length;
                    return (
  <div key={project.id} className="relative rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
    <button
      type="button"
      onClick={() => {
        setProjectFilter(project.id);
        setActiveView("My Tasks");
      }}
      className="w-full text-left"
    >
      <div className="mb-5 flex items-center gap-3">
      <span
    className="h-10 w-10 rounded-xl"
    style={{ backgroundColor: `${project.color}20` }}
   />
   <span className="text-xs text-slate-400">
    {projectTasks.length} tasks
    </span>
    </div>

      <h3 className="font-bold text-slate-900">{project.name}</h3>
      <p className="mt-1 min-h-10 text-sm leading-5 text-slate-500">
        {project.description}
      </p>

      <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
        <span>{projectTasks.length} tasks</span>
        <span>
          {projectTasks.length
            ? Math.round(done / projectTasks.length * 100)
            : 0}% complete
        </span>
      </div>

      <div className="mt-2 h-1.5 rounded-full bg-slate-100">
        <div
          className="h-1.5 rounded-full"
          style={{
            backgroundColor: project.color,
            width: `${projectTasks.length ? done / projectTasks.length * 100 : 0}%`,
          }}
        />
      </div>
    </button>

    <button
      type="button"
      aria-label={`Project options for ${project.name}`}
      onClick={() =>
        setOpenProjectMenu(openProjectMenu === project.id ? null : project.id)
      }
      className="absolute right-5 top-7 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
    >
      <MoreHorizontal size={18} />
    </button>

    {openProjectMenu === project.id && (
      <div className="absolute right-5 top-16 z-10 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
        <button
          type="button"
          onClick={() => {
            setEditingProject(project);
            setEditProjectForm({
              name: project.name,
              description: project.description,
            });
            setOpenProjectMenu(null);
          }}
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
        >
          Edit Project
        </button>

        <button
          type="button"
          onClick={() => removeProject(project)}
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
        >
          Delete Project
        </button>
      </div>
    )}
  </div>
);;
                  })}</div>
                </>}
              </>
            )}
          </div>
        </main>
      </div>

      <Dialog open={taskDialog} onOpenChange={setTaskDialog}>
        <DialogContent>
          <DialogHeader><h2 className="text-xl font-bold text-slate-900">Create a task</h2><p className="text-sm text-slate-500">Add a task to one of your projects.</p></DialogHeader>
          <form onSubmit={createTask} className="space-y-4">
            <Field label="Task title"><input required autoFocus value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="e.g. Prepare launch checklist" className="form-control"/></Field>
            <Field label="Description"><textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Add a little context…" rows={2} className="form-control resize-none"/></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Project"><select required value={taskForm.projectId} onChange={(e) => setTaskForm({ ...taskForm, projectId: e.target.value })} className="form-control">{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
              <Field label="Priority"><select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as TaskPriority })} className="form-control">{priorityOptions.map((p) => <option key={p}>{p}</option>)}</select></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Assignee"><input value={taskForm.assignee} onChange={(e) => setTaskForm({ ...taskForm, assignee: e.target.value })} className="form-control"/></Field>
              <Field label="Due date"><input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} className="form-control"/></Field>
            </div>
            <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setTaskDialog(false)}>Cancel</Button><Button type="submit" disabled={saving || projects.length === 0}>{saving ? "Saving…" : "Create task"}</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={projectDialog} onOpenChange={setProjectDialog}>
        <DialogContent>
          <DialogHeader><h2 className="text-xl font-bold text-slate-900">Create a project</h2><p className="text-sm text-slate-500">Give your next initiative a home.</p></DialogHeader>
          <form onSubmit={createProject} className="space-y-4">
            <Field label="Project name"><input required value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} placeholder="e.g. Customer Portal" className="form-control"/></Field>
            <Field label="Description"><textarea value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} rows={3} className="form-control resize-none" placeholder="What does this project aim to achieve?"/></Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setProjectDialog(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create project"}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
  open={editingProject !== null}
  onOpenChange={(open) => {
    if (!open) setEditingProject(null);
  }}
>
  <DialogContent>
    <DialogHeader>
      <h2 className="text-xl font-bold text-slate-900">Edit Project</h2>
      <p className="text-sm text-slate-500">
        Update your project details.
      </p>
    </DialogHeader>

    <form onSubmit={updateProject} className="space-y-4">
      <Field label="Project name">
        <input
          required
          value={editProjectForm.name}
          onChange={(e) =>
            setEditProjectForm({ ...editProjectForm, name: e.target.value })
          }
          className="form-control"
        />
      </Field>

      <Field label="Description">
        <textarea
          value={editProjectForm.description}
          onChange={(e) =>
            setEditProjectForm({
              ...editProjectForm,
              description: e.target.value,
            })
          }
          rows={3}
          className="form-control resize-none"
        />
      </Field>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setEditingProject(null)}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </form>
  </DialogContent>
</Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-xs font-semibold text-slate-600">{label}</span>{children}</label>;
}

function TaskTable({ tasks, onStatus, onDelete }: {
  tasks: Task[]; onStatus: (task: Task, status: TaskStatus) => void; onDelete: (task: Task) => void;
}) {
  if (!tasks.length) return <div className="p-10 text-center"><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400"><ListTodo size={20}/></div><p className="text-sm font-semibold text-slate-700">No tasks found</p><p className="mt-1 text-xs text-slate-400">Create a task or adjust your filters.</p></div>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left">
    <thead className="border-b border-slate-100 bg-slate-50/70"><tr className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-400"><th className="px-5 py-3">Task</th><th className="px-4 py-3">Project</th><th className="px-4 py-3">Assignee</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Due date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"/></tr></thead>
    <tbody className="divide-y divide-slate-100">{tasks.map((task) => <tr key={task.id} className="group hover:bg-slate-50/70">
      <td className="px-5 py-4"><div className="max-w-[260px]"><div className="truncate text-sm font-semibold text-slate-800">{task.title}</div><div className="mt-1 truncate text-xs text-slate-400">{task.description || "No description"}</div></div></td>
      <td className="px-4 py-4 text-xs text-slate-500">{task.projectName ?? "Project"}</td>
      <td className="px-4 py-4"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-[9px] font-bold text-indigo-700">{initials(task.assignee || "U")}</span><span className="whitespace-nowrap text-xs text-slate-600">{task.assignee}</span></div></td>
      <td className="px-4 py-4"><PriorityMark priority={task.priority}/></td>
      <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-500">{dateLabel(task.dueDate)}</td>
      <td className="px-4 py-4"><select aria-label={`Status for ${task.title}`} value={task.status} onChange={(e) => onStatus(task, e.target.value as TaskStatus)} className="max-w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-600 outline-none focus:border-indigo-400">{statusOptions.map((s) => <option key={s}>{s}</option>)}</select></td>
      <td className="px-4 py-4"><button aria-label={`Delete ${task.title}`} onClick={() => onDelete(task)} className="rounded-lg p-2 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"><Trash2 size={15}/></button></td>
    </tr>)}</tbody>
  </table></div>;
}
