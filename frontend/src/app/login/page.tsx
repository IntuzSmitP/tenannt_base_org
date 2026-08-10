"use client";

import { useState } from "react";
import { fetchApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Login() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: "", // FastAPI OAuth2PasswordRequestForm uses 'username' for email
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetchApi("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: formData.username, // using the username field for email
          password: formData.password
        }),
      });

      // Save token
      localStorage.setItem("token", response.data.access_token);
      
      // Redirect to the tenant dashboard using the slug from the token response
      if (response.data.tenant_slug) {
        router.push(`/${response.data.tenant_slug}/dashboard`);
      } else {
        setError("Failed to resolve workspace.");
      }
      
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-container animate-fade-in">
        <div className="glass-card">
          <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Welcome Back</h2>
          
          {error && <div className="alert alert-error">{error}</div>}
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email Address</label>
              <input 
                type="email" 
                placeholder="you@company.com" 
                required 
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
              />
            </div>
            
            <div className="form-group">
              <label>Password</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                required 
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>
            
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
            
            <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem' }}>
              Don&apos;t have a workspace? <Link href="/register">Create one</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
