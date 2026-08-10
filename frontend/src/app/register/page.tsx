"use client";

import { useState } from "react";
import { fetchApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Register() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    company_name: "",
    owner_name: "",
    owner_email: "",
    owner_password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetchApi("/company/register", {
        method: "POST",
        body: JSON.stringify(formData),
      });

      if (response.success) {
        // Redirect to login after successful registration
        router.push("/login?registered=true");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to register company.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-container animate-fade-in">
        <div className="glass-card">
          <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Create Workspace</h2>
          
          {error && <div className="alert alert-error">{error}</div>}
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Company Name</label>
              <input 
                type="text" 
                placeholder="Acme Corp" 
                required 
                value={formData.company_name}
                onChange={(e) => setFormData({...formData, company_name: e.target.value})}
              />
            </div>
            
            <div className="form-group">
              <label>Your Name</label>
              <input 
                type="text" 
                placeholder="John Doe" 
                required 
                value={formData.owner_name}
                onChange={(e) => setFormData({...formData, owner_name: e.target.value})}
              />
            </div>
            
            <div className="form-group">
              <label>Work Email</label>
              <input 
                type="email" 
                placeholder="john@acme.com" 
                required 
                value={formData.owner_email}
                onChange={(e) => setFormData({...formData, owner_email: e.target.value})}
              />
            </div>
            
            <div className="form-group">
              <label>Password</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                required 
                value={formData.owner_password}
                onChange={(e) => setFormData({...formData, owner_password: e.target.value})}
              />
            </div>
            
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? "Creating..." : "Create Workspace"}
            </button>
            
            <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem' }}>
              Already have an account? <Link href="/login">Sign in</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
