"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { fetchApi } from "@/lib/api";
import { useParams } from "next/navigation";
import { useUser } from "@/app/context/UserContext";

interface User { id: string; name: string; email: string; role: string; [key: string]: unknown; }
interface Invitation { id: string; email: string; name: string; role: string; status: string; expires_at: string; [key: string]: unknown; }
interface TimelineEvent { event_type: string; date: string; description: string; status?: string; }
interface ProfileData { name: string; email: string; current_status: string; role: string; timeline: TimelineEvent[]; }

export default function Users() {
  const params = useParams();
  const slug = params.slug as string;
  const { isAdminOrOwner, user: currentUser } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [deactivatedUsers, setDeactivatedUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('date_desc');
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'active' | 'deactivated' | 'invitations'>('active');
  
  // Search state
  const [activeSearch, setActiveSearch] = useState("");
  const [activeRole, setActiveRole] = useState("ALL");
  
  const [deactivatedSearch, setDeactivatedSearch] = useState("");
  const [deactivatedRole, setDeactivatedRole] = useState("ALL");
  
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteStatus, setInviteStatus] = useState("ALL");

  // Profile Modal state
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Invite Form
  const [showForm, setShowForm] = useState(false);
  const [inviteData, setInviteData] = useState({ email: "", name: "", role: "MEMBER" });
  const [formLoading, setFormLoading] = useState(false);
  const [message, setMessage] = useState("");



  useEffect(() => {
    const fetchUsersAndInvites = async () => {
      setLoading(true);
      try {
        const [usersRes, deactivatedRes, invitesRes] = await Promise.all([
          fetchApi(`/users/`, {}, slug),
          fetchApi(`/users/deactivated`, {}, slug),
          fetchApi(`/users/invitations`, {}, slug)
        ]);
        
        if (usersRes.success) {
          setUsers(usersRes.data);
        }
        if (deactivatedRes.success) {
          setDeactivatedUsers(deactivatedRes.data);
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
    fetchUsersAndInvites();
  }, [slug, refreshKey]);

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
        setInviteData({ email: "", name: "", role: "MEMBER" });
        // Refresh lists seamlessly
        setRefreshKey(prev => prev + 1);
      }
    } catch (err: unknown) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setFormLoading(false);
    }
  };

  const handleResendInvite = async (email: string) => {
    // We need to find the latest invitation ID for this email to resend it
    // Wait, the API `/users/invitations/${id}/resend` uses ID. 
    // From the profile data, we don't have the ID, only the email.
    // Wait, let's change the handleResend to use email or find the ID from invitations list.
    const invite = invitations.find(i => i.email === email);
    if (!invite) return;
    try {
      const res = await fetchApi(`/users/invitations/${invite.id}/resend`, {
        method: "POST"
      }, slug);
      
      if (res.success) {
        setMessage("Invitation resent successfully!");
        setRefreshKey(prev => prev + 1);
        if (profileData && profileData.email === email) {
          handleViewProfile(email);
        }
      }
    } catch (err: unknown) {
      alert(`Failed to resend: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleViewProfile = async (email: string) => {
    setSelectedEmail(email);
    setProfileLoading(true);
    try {
      const res = await fetchApi(`/users/profile?email=${encodeURIComponent(email)}`, {}, slug);
      if (res.success) {
        setProfileData(res.data);
      }
    } catch (err: unknown) {
      alert(`Failed to load profile: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setSelectedEmail(null);
    } finally {
      setProfileLoading(false);
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
    try {
      const impactRes = await fetchApi(`/users/${userId}/impact`, {}, slug);
      if (impactRes.success) {
        const { assigned_tasks_count, project_memberships_count } = impactRes.data;
        if (assigned_tasks_count > 0) {
          if (!confirm(`This user has ${assigned_tasks_count} assigned tasks. Removing the user will unassign these tasks. Proceed?`)) return;
        }
        if (project_memberships_count > 0) {
          if (!confirm(`This user is part of ${project_memberships_count} projects. Removing the user will remove them from these projects. Proceed?`)) return;
        }
      }
    } catch (err) {
      console.error("Failed to fetch user impact", err);
    }

    if (!confirm("Are you absolutely sure you want to completely remove this user from the workspace?")) return;
    
    try {
      const res = await fetchApi(`/users/${userId}`, { method: "DELETE" }, slug);
      if (res.success) {
        setRefreshKey(prev => prev + 1);
      }
    } catch {
      alert("Failed to remove user");
    }
  };

  const handleCancelInvite = async (email: string) => {
    if (!confirm("Are you sure you want to cancel this invitation?")) return;
    
    const invite = invitations.find(i => i.email === email);
    if (!invite) return;
    
    try {
      const res = await fetchApi(`/users/invitations/${invite.id}/cancel`, {
        method: "POST"
      }, slug);
      
      if (res.success) {
        setRefreshKey(prev => prev + 1);
        if (profileData && profileData.email === email) {
          handleViewProfile(email);
        }
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

      <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem' }}>
        <button 
          onClick={() => setActiveTab('active')}
          style={{ background: 'none', border: 'none', padding: '0.5rem 0', color: activeTab === 'active' ? 'var(--primary-color)' : 'var(--text-muted)', borderBottom: activeTab === 'active' ? '2px solid var(--primary-color)' : '2px solid transparent', cursor: 'pointer', fontWeight: activeTab === 'active' ? 600 : 400, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          Active Members <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', background: 'var(--bg-elevated)', borderRadius: '1rem', color: activeTab === 'active' ? 'var(--primary-color)' : 'var(--text-muted)' }}>{users.length}</span>
        </button>
        {deactivatedUsers.length > 0 && isAdminOrOwner && (
          <button 
            onClick={() => setActiveTab('deactivated')}
            style={{ background: 'none', border: 'none', padding: '0.5rem 0', color: activeTab === 'deactivated' ? 'var(--primary-color)' : 'var(--text-muted)', borderBottom: activeTab === 'deactivated' ? '2px solid var(--primary-color)' : '2px solid transparent', cursor: 'pointer', fontWeight: activeTab === 'deactivated' ? 600 : 400, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            Deactivated Members <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', background: 'var(--bg-elevated)', borderRadius: '1rem', color: activeTab === 'deactivated' ? 'var(--primary-color)' : 'var(--text-muted)' }}>{deactivatedUsers.length}</span>
          </button>
        )}
        {isAdminOrOwner && (
          <button 
            onClick={() => setActiveTab('invitations')}
            style={{ background: 'none', border: 'none', padding: '0.5rem 0', color: activeTab === 'invitations' ? 'var(--primary-color)' : 'var(--text-muted)', borderBottom: activeTab === 'invitations' ? '2px solid var(--primary-color)' : '2px solid transparent', cursor: 'pointer', fontWeight: activeTab === 'invitations' ? 600 : 400, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            Invitations <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', background: 'var(--bg-elevated)', borderRadius: '1rem', color: activeTab === 'invitations' ? 'var(--primary-color)' : 'var(--text-muted)' }}>{invitations.length}</span>
          </button>
        )}
      </div>

      {activeTab === 'active' && (
      <div className="card animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ margin: 0 }}>Active Members</h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="Search active..." 
              value={activeSearch}
              onChange={(e) => setActiveSearch(e.target.value)}
              style={{ padding: '0.4rem 0.8rem', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.85rem' }}
            />
            <select 
              value={activeRole} 
              onChange={(e) => setActiveRole(e.target.value)}
              style={{ padding: '0.4rem', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.85rem' }}
            >
              <option value="ALL">All Roles</option>
              <option value="ADMIN">Admin</option>
              <option value="MEMBER">Member</option>
              <option value="OWNER">Owner</option>
            </select>
          </div>
        </div>
        {loading ? (
          <p>Loading members...</p>
        ) : users.filter(u => 
            (activeRole === 'ALL' || u.role === activeRole) &&
            (u.name.toLowerCase().includes(activeSearch.toLowerCase()) || u.email.toLowerCase().includes(activeSearch.toLowerCase()))
          ).length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No members found.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {users.filter(u => 
              (activeRole === 'ALL' || u.role === activeRole) &&
              (u.name.toLowerCase().includes(activeSearch.toLowerCase()) || u.email.toLowerCase().includes(activeSearch.toLowerCase()))
            ).sort((a, b) => {
              if (a.id === currentUser?.id) return -1;
              if (b.id === currentUser?.id) return 1;
              return 0;
            }).map((user) => (
              <div key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong 
                      style={{ cursor: 'pointer', color: 'var(--primary-color)', textDecoration: 'underline' }}
                      onClick={() => handleViewProfile(user.email)}
                    >
                      {user.name}
                    </strong>
                    {user.id === currentUser?.id && <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '0.85rem' }}>(you)</span>}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{user.email}</div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  {isAdminOrOwner && user.role !== "OWNER" && user.id !== currentUser?.id && !(currentUser?.role === 'ADMIN' && user.role === 'ADMIN') ? (
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
                  
                  {isAdminOrOwner && user.role !== "OWNER" && user.id !== currentUser?.id && !(currentUser?.role === 'ADMIN' && user.role === 'ADMIN') && (
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
      )}

      {activeTab === 'deactivated' && deactivatedUsers.length > 0 && isAdminOrOwner && (
        <div className="card animate-fade-in" style={{ marginTop: '0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
              Deactivated Members 
              <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'var(--bg-elevated)', borderRadius: '1rem', color: 'var(--text-muted)' }}>
                {deactivatedUsers.length}
              </span>
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input 
                type="text" 
                placeholder="Search deactivated..." 
                value={deactivatedSearch}
                onChange={(e) => setDeactivatedSearch(e.target.value)}
                style={{ padding: '0.4rem 0.8rem', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.85rem' }}
              />
              <select 
                value={deactivatedRole} 
                onChange={(e) => setDeactivatedRole(e.target.value)}
                style={{ padding: '0.4rem', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.85rem' }}
              >
                <option value="ALL">All Roles</option>
                <option value="ADMIN">Admin</option>
                <option value="MEMBER">Member</option>
              </select>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
            {deactivatedUsers.filter(u => 
              (deactivatedRole === 'ALL' || u.role === deactivatedRole) &&
              (u.name.toLowerCase().includes(deactivatedSearch.toLowerCase()) || u.email.toLowerCase().includes(deactivatedSearch.toLowerCase()))
            ).map((user) => (
              <div key={user.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', opacity: 0.7 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong style={{ color: 'var(--text-muted)' }}>{user.name}</strong>
                      <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', background: 'var(--danger-color)', color: 'white', borderRadius: '4px', opacity: 0.8 }}>
                        DEACTIVATED
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      {user.email}
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {user.role.toLowerCase()}
                  </span>
                  <button 
                    onClick={() => handleViewProfile(user.email)}
                    className="btn-secondary"
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                  >
                    View Profile
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {activeTab === 'invitations' && isAdminOrOwner && (
        <div className="card animate-fade-in" style={{ marginTop: '0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ margin: 0 }}>Invitations</h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input 
                type="text" 
                placeholder="Search invitations..." 
                value={inviteSearch}
                onChange={(e) => setInviteSearch(e.target.value)}
                style={{ padding: '0.4rem 0.8rem', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.85rem' }}
              />
              <select 
                value={inviteStatus} 
                onChange={(e) => setInviteStatus(e.target.value)}
                style={{ padding: '0.4rem', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.85rem' }}
              >
                <option value="ALL">All Status</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="expired">Expired</option>
                <option value="canceled">Canceled</option>
              </select>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                style={{ padding: '0.4rem', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.85rem' }}
              >
                <option value="date_desc">Newest First</option>
                <option value="date_asc">Oldest First</option>
                <option value="status">Sort by Status</option>
              </select>
            </div>
        </div>
        
        {loading ? (
          <p>Loading invitations...</p>
        ) : invitations.filter(i => 
            (inviteStatus === 'ALL' || i.status === inviteStatus) &&
            (i.name.toLowerCase().includes(inviteSearch.toLowerCase()) || i.email.toLowerCase().includes(inviteSearch.toLowerCase()))
          ).length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No invitations match your filters.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[...invitations]
              .filter(i => 
                (inviteStatus === 'ALL' || i.status === inviteStatus) &&
                (i.name.toLowerCase().includes(inviteSearch.toLowerCase()) || i.email.toLowerCase().includes(inviteSearch.toLowerCase()))
              )
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
                      <strong 
                        style={{ cursor: 'pointer', color: 'var(--primary-color)', textDecoration: 'underline' }}
                        onClick={() => handleViewProfile(invite.email)}
                      >
                        {invite.name}
                      </strong>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{invite.email}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary-color)', borderRadius: '4px' }}>
                        {invite.role}
                      </span>
                      <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', border: `1px solid ${statusColor}`, color: statusColor, borderRadius: '4px' }}>
                        {invite.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
      )}

      {selectedEmail && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto', position: 'relative' }}>
            <button 
              onClick={() => { setSelectedEmail(null); setProfileData(null); }}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              &times;
            </button>
            
            {profileLoading || !profileData ? (
              <p>Loading profile...</p>
            ) : (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary-color), var(--accent-color))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold', margin: '0 auto 1rem' }}>
                    {profileData.name.charAt(0).toUpperCase()}
                  </div>
                  <h2 style={{ margin: '0 0 0.5rem 0' }}>{profileData.name}</h2>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{profileData.email}</div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary-color)', borderRadius: '4px' }}>
                      {profileData.role}
                    </span>
                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                      {profileData.current_status.toUpperCase()}
                    </span>
                  </div>
                  
                </div>
                
                {(() => {
                  const latestEvent = profileData.timeline[0];
                  const canResend = latestEvent && latestEvent.event_type === 'invited' && (latestEvent.status === 'pending' || latestEvent.status === 'expired' || latestEvent.status === 'canceled');
                  const canCancel = latestEvent && latestEvent.event_type === 'invited' && latestEvent.status === 'pending';
                  
                  if (!isAdminOrOwner || !canResend) return null;
                  
                  return (
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem', marginBottom: '2rem' }}>
                      <button 
                        onClick={() => handleResendInvite(profileData.email)}
                        className="btn btn-primary"
                        style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                      >
                        Resend Invitation
                      </button>
                      {canCancel && (
                        <button 
                          onClick={() => handleCancelInvite(profileData.email)}
                          className="btn"
                          style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', background: 'transparent', border: '1px solid var(--danger-color)', color: 'var(--danger-color)' }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  );
                })()}

                <h3>History & Timeline</h3>
                <div style={{ position: 'relative', borderLeft: '2px solid var(--border-color)', marginLeft: '1rem', paddingLeft: '1.5rem', marginTop: '1.5rem' }}>
                  {profileData.timeline.map((event, idx) => (
                    <div key={idx} style={{ marginBottom: '1.5rem', position: 'relative' }}>
                      <div style={{
                        position: 'absolute',
                        left: '-1.85rem',
                        top: '0.2rem',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: event.event_type === 'joined' || event.event_type === 'accepted' ? 'var(--success-color)' : 'var(--primary-color)',
                        border: '2px solid var(--bg-base)'
                      }} />
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                        {new Date(event.date).toLocaleString()}
                      </div>
                      <div style={{ fontWeight: '500' }}>{event.description}</div>
                      {event.status && (
                        <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', marginTop: '0.5rem', display: 'inline-block' }}>
                          Status: {event.status.toUpperCase()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
