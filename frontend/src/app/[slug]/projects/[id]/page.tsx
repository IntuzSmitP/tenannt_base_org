"use client";

import { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/app/context/UserContext";

interface Project { id?: string; name: string; description: string; }
interface Task { id: string; title: string; description: string; priority: string; assigned_to: string; status: string; project_id: string; }
interface User { id: string; name: string; email: string; role: string; is_deactivated?: boolean; }

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

  // View Task State
  const [viewingTask, setViewingTask] = useState<Task | null>(null);

  // Edit Task State
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTaskData, setEditTaskData] = useState({
    title: "",
    description: "",
    priority: "medium",
    assigned_to: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projRes, tasksRes, usersRes, deactUsersRes] = await Promise.all([
          fetchApi(`/projects/${projectId}`, {}, slug),
          fetchApi(`/tasks/project/${projectId}`, {}, slug),
          fetchApi(`/users/`, {}, slug),
          fetchApi(`/users/deactivated`, {}, slug)
        ]);
        
        if (projRes.success) {
          setProject(projRes.data);
          setEditProjectData({ name: projRes.data.name, description: projRes.data.description || "" });
        }
        if (tasksRes.success) setTasks(tasksRes.data);
        if (usersRes.success) {
          const activeUsers = usersRes.data || [];
          const deactUsers = deactUsersRes?.success ? deactUsersRes.data.map((u: User) => ({ ...u, is_deactivated: true })) : [];
          setUsers([...activeUsers, ...deactUsers]);
        }
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

  const handleSaveEditTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    try {
      const res = await fetchApi(`/tasks/${editingTask.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: editTaskData.title,
          description: editTaskData.description || null,
          priority: editTaskData.priority,
          assigned_to: editTaskData.assigned_to || null,
        }),
      }, slug);
      if (res.success) {
        setTasks(tasks.map(t => t.id === editingTask.id ? res.data : t));
        setEditingTask(null);
      }
    } catch {
      alert("Failed to update task");
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
    try {
      const impactRes = await fetchApi(`/projects/${projectId}/impact`, {}, slug);
      if (impactRes.success) {
        const { tasks_count, members_count } = impactRes.data;
        if (tasks_count > 0) {
          if (!confirm(`This project has ${tasks_count} tasks. Deleting the project will delete all these tasks. Proceed?`)) return;
        }
        if (members_count > 0) {
          if (!confirm(`This project has ${members_count} members. Deleting the project will remove all members from it. Proceed?`)) return;
        }
      }
    } catch (err) {
      console.error("Failed to fetch project impact", err);
    }

    if (!confirm("Are you absolutely sure you want to delete this project?")) return;
    
    setEditProjectLoading(true);
    try {
      const res = await fetchApi(`/projects/${projectId}`, { method: "DELETE" }, slug);
      if (res.success) {
        window.location.href = `/${slug}/dashboard`;
      }
    } catch {
      alert("Failed to delete project");
    } finally {
      setEditProjectLoading(false);
    }
  };

  if (loading) return <div>Loading project...</div>;
  if (!project) return <div>Project not found.</div>;

  const getAssigneeName = (userId: string) => {
    if (!userId) return "Unassigned";
    const user = users.find(u => u.id === userId);
    if (!user) return "Unknown User";
    return user.is_deactivated ? `${user.name} (Deactivated)` : user.name;
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
                  maxLength={100}
                  className="input"
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
                  maxLength={100}
                  className="input"
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
                  {users.filter(u => !u.is_deactivated).map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
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

      {/* View Task Details Modal */}
      {viewingTask && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ padding: '3rem', width: '600px', maxWidth: '90%', maxHeight: '80vh', overflowY: 'auto', position: 'relative' }}>
            <button 
              onClick={() => setViewingTask(null)}
              style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'var(--bg-elevated)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: 'var(--text-muted)' }}
            >
              ✕
            </button>
            <div style={{ marginBottom: '2rem' }}>
              <span style={{ display: 'inline-block', padding: '0.3rem 0.8rem', background: 'var(--primary-color)', color: 'white', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                {viewingTask.priority.toUpperCase()} PRIORITY
              </span>
              <h2 style={{ fontSize: '1.8rem', margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>{viewingTask.title}</h2>
              
              <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>STATUS</div>
                  <div style={{ fontWeight: '500' }}>{viewingTask.status.replace('_', ' ').toUpperCase()}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>ASSIGNEE</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: viewingTask.assigned_to ? 'var(--primary-color)' : 'transparent', border: viewingTask.assigned_to ? 'none' : '1px dashed var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: viewingTask.assigned_to ? 'white' : 'var(--text-muted)', fontWeight: 'bold' }}>
                      {viewingTask.assigned_to ? getAssigneeName(viewingTask.assigned_to).charAt(0).toUpperCase() : "-"}
                    </div>
                    <span style={{ fontWeight: '500' }}>{getAssigneeName(viewingTask.assigned_to)}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 style={{ fontSize: '1.2rem', margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>Description</h3>
                <div style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
                  {viewingTask.description || "No description provided."}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ padding: '2rem', width: '500px', maxWidth: '90%' }}>
            <h3>Edit Task</h3>
            <form onSubmit={handleSaveEditTask}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Task Title</label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  className="input"
                  value={editTaskData.title}
                  onChange={(e) => setEditTaskData({...editTaskData, title: e.target.value})}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Description</label>
                <textarea
                  className="input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  value={editTaskData.description}
                  onChange={(e) => setEditTaskData({...editTaskData, description: e.target.value})}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label>Assign To</label>
                  <select 
                    className="input"
                    value={editTaskData.assigned_to}
                    onChange={(e) => setEditTaskData({...editTaskData, assigned_to: e.target.value})}
                  >
                    <option value="">Unassigned</option>
                    {users.filter(u => !u.is_deactivated).map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Priority</label>
                  <select
                    className="input"
                    value={editTaskData.priority}
                    onChange={(e) => setEditTaskData({...editTaskData, priority: e.target.value})}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setEditingTask(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
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
                <div 
                  key={task.id} 
                  className="card" 
                  style={{ 
                    padding: '1.25rem', 
                    background: 'var(--bg-base)', 
                    borderTop: `3px solid ${col.color}`,
                    borderRadius: 'var(--radius-md)',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ 
                        fontSize: '0.65rem', 
                        fontWeight: 700, 
                        padding: '0.2rem 0.5rem', 
                        borderRadius: '4px',
                        background: task.priority === 'urgent' ? 'rgba(239, 68, 68, 0.1)' : task.priority === 'high' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                        color: task.priority === 'urgent' ? 'var(--danger-color)' : task.priority === 'high' ? 'var(--warning-color)' : 'var(--primary-color)'
                      }}>
                        {task.priority.toUpperCase()}
                      </span>
                    </div>

                    {isAdminOrOwner && (
                      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                        <button 
                          onClick={() => {
                            setEditingTask(task);
                            setEditTaskData({
                              title: task.title,
                              description: task.description || "",
                              priority: task.priority,
                              assigned_to: task.assigned_to || ""
                            });
                          }} 
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', opacity: 0.7, fontSize: '0.8rem' }}
                          title="Edit Task"
                        >
                          ✎
                        </button>
                        <button 
                          onClick={() => handleDeleteTask(task.id)} 
                          style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', opacity: 0.7, fontSize: '0.8rem' }}
                          title="Delete Task"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    {task.title}
                  </h5>
                  
                  {task.description && (
                    <div style={{ marginBottom: '1rem' }}>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: 0, lineHeight: 1.5 }}>
                        {task.description}
                      </p>
                      {task.description.length > 80 && (
                        <button 
                          onClick={() => setViewingTask(task)} 
                          style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.75rem', cursor: 'pointer', padding: 0, marginTop: '0.4rem', fontWeight: 600 }}
                        >
                          Read more
                        </button>
                      )}
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {task.assigned_to ? (
                        <>
                          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'white', fontWeight: 'bold' }} title={getAssigneeName(task.assigned_to)}>
                            {getAssigneeName(task.assigned_to).charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {getAssigneeName(task.assigned_to).split(' ')[0]}
                          </span>
                        </>
                      ) : (
                        <>
                          <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: '1px dashed var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'var(--text-muted)' }} title="Unassigned">
                            -
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Unassigned
                          </span>
                        </>
                      )}
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
