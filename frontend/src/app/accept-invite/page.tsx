"use client";

import { useState, Suspense, useEffect } from "react";
import { fetchApi } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const slug = searchParams.get("slug");
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [success, setSuccess] = useState(false);

  // We check for invalid params during render instead of in useEffect
  const isInvalidParams = !token || !slug;
  
  useEffect(() => {
    if (isInvalidParams) {
      setValidating(false);
      return;
    }
    
    const validateToken = async () => {
      try {
        const response = await fetchApi(`/users/invitations/validate?token=${token}`, {}, slug);
        if (!response.success) {
          setTokenError("Invalid or expired invitation link.");
        }
      } catch (err: any) {
        setTokenError(err.message || "Failed to validate invitation.");
      } finally {
        setValidating(false);
      }
    };
    
    validateToken();
  }, [token, slug, isInvalidParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !slug) return;
    
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    setError("");
    setLoading(true);

    try {
      const response = await fetchApi("/users/accept-invite", {
        method: "POST",
        body: JSON.stringify({ token, password: password.trim(), confirm_password: confirmPassword.trim() }),
      }, slug);

      if (response.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to accept invitation.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-layout">
        <div className="auth-container animate-fade-in">
          <div className="glass-card" style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--success-color)', fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
            <h2>Invitation Accepted!</h2>
            <p>Your account has been created successfully. Redirecting to login...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-layout">
      <div className="auth-container animate-fade-in">
        <div className="glass-card">
          <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>Join Workspace</h2>
          <p style={{ textAlign: 'center', marginBottom: '2rem', wordBreak: 'break-all', overflowWrap: 'break-word' }}>You&apos;ve been invited to join <strong>{slug}</strong>.</p>
          
          {validating ? (
            <div style={{ textAlign: 'center' }}>Validating invitation link...</div>
          ) : isInvalidParams ? (
            <div className="alert alert-error">Invalid invitation link. Missing token or workspace slug.</div>
          ) : tokenError ? (
            <div className="alert alert-error">{tokenError}</div>
          ) : (
            <>
              {error && <div className="alert alert-error">{error}</div>}
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                <label>Set your Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  required 
                  maxLength={128}
                  pattern=".*\S+.*"
                  title="Password cannot be just whitespace"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Confirm Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  required 
                  maxLength={128}
                  pattern=".*\S+.*"
                  title="Password cannot be just whitespace"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? "Joining..." : "Accept & Join"}
              </button>
            </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvite() {
  return (
    <Suspense fallback={<div className="auth-layout">Loading...</div>}>
      <AcceptInviteForm />
    </Suspense>
  );
}
