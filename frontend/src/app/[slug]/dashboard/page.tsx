"use client";

import { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";
import { useParams } from "next/navigation";
import { useUser } from "@/app/context/UserContext";
import Link from "next/link";

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

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const [projRes, tasksRes] = await Promise.all([
          fetchApi("/projects/", {}, slug),
          fetchApi("/tasks/me", {}, slug)
        ]);
        
        if (projRes.success) setProjects(projRes.data);
        if (tasksRes.success) setMyTasks(tasksRes.data);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [slug]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const res = await fetchApi("/projects/", {
        method: "POST",
        body: JSON.stringify(newProject),
      }, slug);
      
      if (res.success) {
        setProjects([...projects, res.data]);
        setShowForm(false);
        setNewProject({ name: "", description: "" });
      }
    } catch {
      alert("Failed to create project");
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
                  <h4 style={{ margin: '0 0 0.5rem 0' }}>{task.title}</h4>
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
            <div key={project.id} className="card">
              <h3>{project.name}</h3>
              <p>{project.description || "No description provided."}</p>
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status: {project.status}</span>
                <Link href={`/${slug}/projects/${project.id}`} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', textDecoration: 'none' }}>
                  View Tasks
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
