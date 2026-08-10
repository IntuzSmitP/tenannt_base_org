"use client";

import { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";
import { useParams } from "next/navigation";
import { useUser } from "@/app/context/UserContext";

interface User { id: string; name: string; email: string; role: string; [key: string]: unknown; }
interface Invitation { id: string; email: string; name: string; role: string; status: string; expires_at: string; [key: string]: unknown; }

export default function Users() {
  const params = useParams();
  const slug = params.slug as string;
  const { isAdminOrOwner } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('date_desc');
  
  // Invite Form
  const [showForm, setShowForm] = useState(false);
  const [inviteData, setInviteData] = useState({ email: "", name: "", role: "MEMBER" });
  const [formLoading, setFormLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchUsersAndInvites = async () => {
      try {
        const [usersRes, invitesRes] = await Promise.all([
          fetchApi("/users/", {}, slug),
          fetchApi("/users/invitations", {}, slug)
        ]);
        
        if (usersRes.success) {
          setUsers(usersRes.data);
        }
        if (invitesRes.success) {
          setInvitations(invitesRes.data);
        }
      } catch (err) {
        console.error("Failed to load members", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsersAndInvites();
  }, [slug]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setMessage("");
    try {
      const res = await fetchApi("/users/invite", {
        method: "POST",
        body: JSON.stringify(inviteData),
      }, slug);
      
      if (res.success) {
        setMessage(`Invitation sent to ${inviteData.email}!`);
        setShowForm(false);
        setInviteData({ email: "", name: "", role: "MEMBER" });
      }
    } catch (err: unknown) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetchApi(`/users/${userId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role: newRole }),
      }, slug);
      if (res.success) {
        setUsers(users.map((u) => u.id === userId ? { ...u, role: newRole } : u));
      }
    } catch {
      alert("Failed to update user role");
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!confirm("Are you sure you want to completely remove this user from the workspace?")) return;
    try {
      const res = await fetchApi(`/users/${userId}`, { method: "DELETE" }, slug);
      if (res.success) {
        setUsers(users.filter((u) => u.id !== userId));
      }
    } catch {
      alert("Failed to remove user");
    }
  };

  const handleCancelInvite = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this invitation?")) return;
    
    try {
      const res = await fetchApi(`/users/invitations/${id}/cancel`, {
        method: "POST"
      }, slug);
      
      if (res.success) {
        // Refresh lists
        window.location.reload(); // Simple way to refresh since fetchUsersAndInvites is now inside useEffect
      }
    } catch (err: unknown) {
      alert(`Failed to cancel: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Team Members</h2>
        {isAdminOrOwner && (
          <button 
            className="btn btn-primary" 
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? "Cancel" : "+ Invite Member"}
          </button>
        )}
      </div>
      
      {message && <div className={message.startsWith("Error") ? "alert alert-error" : "alert alert-success"}>{message}</div>}

      {showForm && (
        <div className="card animate-fade-in" style={{ marginBottom: '2rem' }}>
          <form onSubmit={handleInvite}>
            <div className="form-group">
              <label>Name</label>
              <input 
                type="text" 
                required 
                value={inviteData.name}
                onChange={(e) => setInviteData({...inviteData, name: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input 
                type="email" 
                required 
                value={inviteData.email}
                onChange={(e) => setInviteData({...inviteData, email: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select 
                value={inviteData.role}
                onChange={(e) => setInviteData({...inviteData, role: e.target.value})}
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={formLoading}>
              {formLoading ? "Sending..." : "Send Invitation"}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Active Members</h3>
        {loading ? (
          <p>Loading members...</p>
        ) : users.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No members found.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {users.map((user) => (
              <div key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <strong>{user.name}</strong>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{user.email}</div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  {isAdminOrOwner && user.role !== "OWNER" ? (
                    <select 
                      value={user.role} 
                      onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                      style={{ fontSize: '0.75rem', padding: '0.2rem', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '4px', width: 'auto' }}
                    >
                      <option value="MEMBER">MEMBER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  ) : (
                    <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', background: 'var(--bg-elevated)', borderRadius: '10px' }}>
                      {user.role}
                    </span>
                  )}
                  
                  {isAdminOrOwner && user.role !== "OWNER" && (
                    <button 
                      onClick={() => handleRemoveUser(user.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '0.9rem' }}
                      title="Remove user"
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isAdminOrOwner && (
        <div className="card" style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>Invitations</h3>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            style={{ width: 'auto', padding: '0.5rem', background: 'var(--bg-base)' }}
          >
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="status">By Status</option>
          </select>
        </div>
        
        {loading ? (
          <p>Loading invitations...</p>
        ) : invitations.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No pending invitations.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[...invitations]
              .sort((a, b) => {
                if (sortBy === 'date_desc') return new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime();
                if (sortBy === 'date_asc') return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
                if (sortBy === 'status') return a.status.localeCompare(b.status);
                return 0;
              })
              .map((invite) => {
                let statusColor = 'var(--text-muted)';
                if (invite.status === 'pending') statusColor = 'var(--warning-color)';
                if (invite.status === 'accepted') statusColor = 'var(--success-color)';
                if (invite.status === 'expired') statusColor = 'var(--danger-color)';
                
                return (
                  <div key={invite.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)' }}>
                    <div>
                      <strong>{invite.name}</strong>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{invite.email}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary-color)', borderRadius: '4px' }}>
                        {invite.role}
                      </span>
                      <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', border: `1px solid ${statusColor}`, color: statusColor, borderRadius: '4px' }}>
                        {invite.status.toUpperCase()}
                      </span>
                      {invite.status === 'pending' && (
                        <button 
                          onClick={() => handleCancelInvite(invite.id)}
                          style={{ 
                            background: 'transparent', 
                            border: '1px solid var(--danger-color)', 
                            color: 'var(--danger-color)', 
                            padding: '0.2rem 0.5rem', 
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
