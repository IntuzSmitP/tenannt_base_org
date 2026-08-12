"use client";

import { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";
import { useParams } from "next/navigation";
import { useUser } from "@/app/context/UserContext";
import Link from "next/link";
import Pagination from "@/components/Pagination";
import { useWebSocket } from "@/hooks/useWebSocket";

interface Project { id: string; name: string; description: string; status: string; [key: string]: unknown; }
interface Task { id: string; title: string; status: string; priority: string; project_id: string; [key: string]: unknown; }

export default function Dashboard() {
  const params = useParams();
  const slug = params.slug as string;
  const { isAdminOrOwner } = useUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New Project Form
  const [showForm, setShowForm] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", description: "" });
  const [formLoading, setFormLoading] = useState(false);

  // Pagination
  const PAGE_SIZE = 9;
  const [projectPage, setProjectPage] = useState(1);
  const [projectTotal, setProjectTotal] = useState(0);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const [projRes, tasksRes] = await Promise.all([
          fetchApi(`/projects/?page=${projectPage}&page_size=${PAGE_SIZE}`, {}, slug),
          fetchApi("/tasks/me", {}, slug)
        ]);
        
        if (projRes.success) {
          setProjects(projRes.data);
          setProjectTotal(projRes.total ?? 0);
        }
        if (tasksRes.success) setMyTasks(tasksRes.data);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [slug, projectPage]);

  // WebSocket Integration for Dashboard
  const { isConnected, addListener } = useWebSocket(slug);
  const { user } = useUser();

  useEffect(() => {
    const currentUserId = user?.id as string | undefined;

    const removeListener = addListener((event) => {
      if (event.type === "PROJECT_UPDATED") {
        setProjects((prev) => prev.map(p => p.id === event.payload.id ? { ...p, ...event.payload } : p));
      } else if (event.type === "PROJECT_DELETED") {
        setProjects((prev) => prev.filter(p => p.id !== event.payload.id));
      } else if (event.type === "TASK_CREATED") {
        // If a new task is assigned to me, add it to My Tasks
        if (currentUserId && event.payload.assigned_to === currentUserId) {
          setMyTasks((prev) => {
            if (prev.some(t => t.id === event.payload.id)) return prev;
            return [...prev, event.payload];
          });
        }
      } else if (event.type === "TASK_UPDATED") {
        if (currentUserId) {
          setMyTasks((prev) => {
            const wasMyTask = prev.some(t => t.id === event.payload.id);
            const isNowMyTask = event.payload.assigned_to === currentUserId;

            if (wasMyTask && !isNowMyTask) {
              // Reassigned away from me — remove it
              return prev.filter(t => t.id !== event.payload.id);
            } else if (!wasMyTask && isNowMyTask) {
              // Reassigned to me — add it
              return [...prev, event.payload];
            } else if (wasMyTask && isNowMyTask) {
              // Still mine — just update it
              return prev.map(t => t.id === event.payload.id ? { ...t, ...event.payload } : t);
            }
            return prev;
          });
        }
      } else if (event.type === "TASK_DELETED") {
        setMyTasks((prev) => prev.filter(t => t.id !== event.payload.id));
      }
    });

    return () => removeListener();
  }, [addListener, user]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const res = await fetchApi("/projects/", {
        method: "POST",
        body: JSON.stringify({
          name: newProject.name.trim(),
          description: newProject.description?.trim() || ""
        }),
      }, slug);
      
      if (res.success) {
        setProjects([...projects, res.data]);
        setShowForm(false);
        setNewProject({ name: "", description: "" });
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) {
    return <div>Loading projects...</div>;
  }

  return (
    <div>
      {/* My Tasks Section */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2>My Tasks</h2>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {myTasks.length === 0 ? (
            <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>You don&apos;t have any tasks assigned to you right now.</p>
            </div>
          ) : (
            myTasks.map(task => (
              <div key={task.id} className="card" style={{ borderLeft: task.status === 'done' ? '3px solid var(--success-color)' : '3px solid var(--primary-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</h4>
                  <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'var(--bg-elevated)', borderRadius: '10px' }}>
                    {task.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Priority: {task.priority.toUpperCase()}
                  </span>
                  <Link href={`/${slug}/projects/${task.project_id}`} style={{ fontSize: '0.8rem' }}>
                    Go to Project &rarr;
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Projects</h2>
        {isAdminOrOwner && (
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ New Project"}
          </button>
        )}
      </div>
      
      {showForm && (
        <div className="card animate-fade-in" style={{ marginBottom: '2rem' }}>
          <form onSubmit={handleCreateProject}>
            <div className="form-group">
              <label>Project Name</label>
              <input 
                type="text" 
                required 
                maxLength={100}
                pattern=".*\S+.*"
                title="This field cannot contain only whitespace"
                value={newProject.name}
                onChange={(e) => setNewProject({...newProject, name: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea 
                value={newProject.description}
                onChange={(e) => setNewProject({...newProject, description: e.target.value})}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={formLoading}>
              Create Project
            </button>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {projects.length === 0 ? (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
            <h3 style={{ color: 'var(--text-secondary)' }}>No projects yet</h3>
            <p>Create your first project to get started.</p>
          </div>
        ) : (
          projects.map((project) => (
            <div key={project.id} className="card" style={{ overflow: 'hidden' }}>
              <h3 style={{ 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                margin: '0 0 0.5rem 0'
              }}>{project.name}</h3>
              <p style={{ 
                display: '-webkit-box', 
                WebkitLineClamp: 2, 
                WebkitBoxOrient: 'vertical', 
                overflow: 'hidden', 
                color: 'var(--text-secondary)',
                fontSize: '0.9rem',
                lineHeight: 1.5,
                margin: '0 0 0.5rem 0',
                overflowWrap: 'anywhere',
                wordBreak: 'break-all'
              }}>{project.description || "No description provided."}</p>
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                <Link href={`/${slug}/projects/${project.id}`} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', textDecoration: 'none' }}>
                  View Tasks
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
      <Pagination page={projectPage} pageSize={PAGE_SIZE} total={projectTotal} onPageChange={setProjectPage} />
    </div>
  );
}
