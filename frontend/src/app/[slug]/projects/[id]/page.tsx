"use client";

import { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/app/context/UserContext";

interface Project { id?: string; name: string; description: string; }
interface Task { id: string; title: string; description: string; priority: string; assigned_to: string; status: string; project_id: string; }
interface User { id: string; name: string; email: string; role: string; }

export default function ProjectDetails() {
  const params = useParams();
  const slug = params.slug as string;
  const projectId = params.id as string;
  const { isAdminOrOwner } = useUser();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Project State
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editProjectData, setEditProjectData] = useState({ name: "", description: "" });
  const [editProjectLoading, setEditProjectLoading] = useState(false);

  // New Task Form
  const [showForm, setShowForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    assigned_to: "",
  });
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projRes, tasksRes, usersRes] = await Promise.all([
          fetchApi(`/projects/${projectId}`, {}, slug),
          fetchApi(`/tasks/project/${projectId}`, {}, slug),
          fetchApi(`/users/`, {}, slug)
        ]);
        
        if (projRes.success) {
          setProject(projRes.data);
          setEditProjectData({ name: projRes.data.name, description: projRes.data.description || "" });
        }
        if (tasksRes.success) setTasks(tasksRes.data);
        if (usersRes.success) setUsers(usersRes.data);
      } catch (err) {
        console.error("Failed to load project details", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [slug, projectId]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const res = await fetchApi("/tasks/", {
        method: "POST",
        body: JSON.stringify({
          ...newTask,
          project_id: projectId,
          assigned_to: newTask.assigned_to || null
        }),
      }, slug);
      
      if (res.success) {
        setTasks([...tasks, res.data]);
        setShowForm(false);
        setNewTask({ title: "", description: "", priority: "medium", assigned_to: "" });
      }
    } catch {
      alert("Failed to create task");
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateStatus = async (taskId: string, newStatus: string) => {
    try {
      const res = await fetchApi(`/tasks/${taskId}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      }, slug);
      
      if (res.success) {
        setTasks(tasks.map(t => t.id === taskId ? res.data : t));
      }
    } catch {
      alert("Failed to update status");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      const res = await fetchApi(`/tasks/${taskId}`, { method: "DELETE" }, slug);
      if (res.success) {
        setTasks(tasks.filter(t => t.id !== taskId));
      }
    } catch {
      alert("Failed to delete task");
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditProjectLoading(true);
    try {
      const res = await fetchApi(`/projects/${projectId}`, {
        method: "PUT",
        body: JSON.stringify(editProjectData),
      }, slug);
      if (res.success) {
        setProject(res.data);
        setIsEditingProject(false);
      }
    } catch {
      alert("Failed to update project");
    } finally {
      setEditProjectLoading(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm("Are you absolutely sure you want to delete this project? This will delete all tasks within it.")) return;
    try {
      const res = await fetchApi(`/projects/${projectId}`, { method: "DELETE" }, slug);
      if (res.success) {
        router.push(`/${slug}/dashboard`);
      }
    } catch {
      alert("Failed to delete project");
    }
  };

  if (loading) return <div>Loading project...</div>;
  if (!project) return <div>Project not found.</div>;

  const getAssigneeName = (userId: string) => {
    if (!userId) return "Unassigned";
    const user = users.find(u => u.id === userId);
    return user ? user.name : "Unknown User";
  };

  const columns = [
    { id: 'todo', title: 'To Do', color: 'var(--text-muted)' },
    { id: 'in_progress', title: 'In Progress', color: 'var(--primary-color)' },
    { id: 'review', title: 'Review', color: 'var(--warning-color)' },
    { id: 'done', title: 'Done', color: 'var(--success-color)' }
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button className="btn btn-secondary" onClick={() => router.push(`/${slug}/dashboard`)}>
          &larr; Back
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {project.name}
            {isAdminOrOwner && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => setIsEditingProject(!isEditingProject)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem' }}
                >
                  ✎ Edit
                </button>
                <button 
                  onClick={handleDeleteProject}
                  style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '0.9rem' }}
                >
                  🗑 Delete
                </button>
              </div>
            )}
          </h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{project.description}</p>
        </div>
        {isAdminOrOwner && (
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ New Task"}
          </button>
        )}
      </div>

      {isEditingProject && isAdminOrOwner && (
        <div className="card animate-fade-in" style={{ marginBottom: '2rem', borderLeft: '3px solid var(--warning-color)' }}>
          <h3>Edit Project</h3>
          <form onSubmit={handleUpdateProject} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Project Name</label>
              <input 
                type="text" 
                required 
                value={editProjectData.name}
                onChange={(e) => setEditProjectData({...editProjectData, name: e.target.value})}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Description</label>
              <textarea 
                value={editProjectData.description}
                onChange={(e) => setEditProjectData({...editProjectData, description: e.target.value})}
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={editProjectLoading}>
                Save Changes
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setIsEditingProject(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showForm && isAdminOrOwner && (
        <div className="card animate-fade-in" style={{ marginBottom: '2rem' }}>
          <form onSubmit={handleCreateTask}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Task Title</label>
                <input 
                  type="text" 
                  required 
                  value={newTask.title}
                  onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Assign To</label>
                <select 
                  value={newTask.assigned_to}
                  onChange={(e) => setNewTask({...newTask, assigned_to: e.target.value})}
                >
                  <option value="">-- Unassigned --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Description</label>
                <textarea 
                  value={newTask.description}
                  onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select 
                  value={newTask.priority}
                  onChange={(e) => setNewTask({...newTask, priority: e.target.value})}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={formLoading} style={{ marginTop: '1rem' }}>
              Create Task
            </button>
          </form>
        </div>
      )}

      {/* Task Board */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', minHeight: '60vh' }}>
        {columns.map(col => (
          <div key={col.id} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
            <h4 style={{ color: col.color, marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              {col.title} <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>({tasks.filter(t => t.status === col.id).length})</span>
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {tasks.filter(t => t.status === col.id).map(task => (
                <div key={task.id} className="card" style={{ padding: '1rem', background: 'var(--bg-base)', borderLeft: `3px solid ${col.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h5 style={{ margin: '0 0 0.5rem 0' }}>{task.title}</h5>
                    {isAdminOrOwner && (
                      <button onClick={() => handleDeleteTask(task.id)} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', opacity: 0.5 }}>✕</button>
                    )}
                  </div>
                  
                  {task.description && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {task.description}
                    </p>
                  )}
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'white' }} title={getAssigneeName(task.assigned_to)}>
                        {getAssigneeName(task.assigned_to).charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {task.priority.toUpperCase()}
                      </span>
                    </div>
                    
                    <select 
                      value={task.status} 
                      onChange={(e) => handleUpdateStatus(task.id, e.target.value)}
                      style={{ fontSize: '0.75rem', padding: '0.2rem', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)' }}
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="review">Review</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
