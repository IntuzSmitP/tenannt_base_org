"use client";

import { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/app/context/UserContext";

export default function Settings() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const { user } = useUser();
  const isOwner = user?.role === 'OWNER';

  const [impactData, setImpactData] = useState<{ projects_count: number, tasks_count: number, users_count: number } | null>(null);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOwner) {
      fetchApi("/company/impact", {}, slug).then(res => {
        if (res.success) setImpactData(res.data);
      }).catch(err => console.error(err));
    }
  }, [isOwner, slug]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  const handleDeleteOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!impactData) return;

    if (!confirm(`Are you absolutely sure you want to delete this organization? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetchApi("/company/", {
        method: "DELETE",
        body: JSON.stringify({
          email: deleteEmail,
          password: deletePassword,
        })
      }, slug);

      if (res.success) {
        alert("Organization deleted successfully.");
        localStorage.removeItem("token");
        window.location.href = "/login";
      }
    } catch (err: unknown) {
      alert(`Failed to delete organization: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Workspace Settings</h2>
        <button onClick={handleLogout} className="btn btn-secondary">
          Log out
        </button>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3>Profile Information</h3>
        <div style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
          <p><strong>Name:</strong> {user?.name as string}</p>
          <p><strong>Email:</strong> {user?.email as string}</p>
          <p><strong>Role:</strong> {user?.role as string}</p>
        </div>
      </div>

      {isOwner && (
        <div className="card" style={{ border: '1px solid var(--danger-color)', background: 'rgba(239, 68, 68, 0.05)' }}>
          <h3 style={{ color: 'var(--danger-color)' }}>Danger Zone: Delete Organization</h3>

          {impactData ? (
            <div style={{ marginTop: '1rem' }}>
              <div className="alert alert-warning">
                <strong>Warning:</strong> Deleting the organization is permanent. The following connected data will be permanently disabled:
                <ul style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
                  <li>{impactData.projects_count} Projects</li>
                  <li>{impactData.tasks_count} Tasks</li>
                  <li>{impactData.users_count} Members</li>
                </ul>
              </div>

              <form onSubmit={handleDeleteOrganization} style={{ marginTop: '1.5rem' }}>
                <p style={{ marginBottom: '1rem' }}>To confirm deletion, please enter your email and password.</p>
                <div className="form-group">
                  <label>Owner Email</label>
                  <input
                    type="email"
                    required
                    value={deleteEmail}
                    onChange={(e) => setDeleteEmail(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    required
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ background: 'var(--danger-color)' }} disabled={loading}>
                  {loading ? "Deleting..." : "Permanently Delete Organization"}
                </button>
              </form>
            </div>
          ) : (
            <p>Loading impact data...</p>
          )}
        </div>
      )}
    </div>
  );
}
