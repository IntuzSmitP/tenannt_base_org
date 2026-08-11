"use client";

import { usePathname, useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';
import { UserProvider } from '@/app/context/UserContext';

interface UserProfile { name: string; role: string; [key: string]: unknown; }
interface Project { id: string; name: string; }

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const slug = params.slug as string;
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [companyName, setCompanyName] = useState<string>(slug);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    // Authenticate and fetch user profile
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    fetchApi('/users/me', {}, slug)
      .then(res => {
        if (res.success) {
          setUser(res.data);
          
          fetchApi('/company/info', {}, slug).then(cRes => {
            if (cRes.success) {
              setCompanyName(cRes.data.name);
            }
          }).catch(console.error);

          fetchApi('/projects/', {}, slug).then(pRes => {
            if (pRes.success) {
              setProjects(pRes.data);
            }
          }).catch(console.error);
        } else {
          router.push('/login');
        }
      })
      .catch(() => {
        localStorage.removeItem('token');
        router.push('/login');
      });
  }, [slug, router]);

  if (!user) {
    return <div className="auth-layout">Loading workspace...</div>;
  }

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header" style={{ overflow: 'hidden', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
            <div style={{ background: 'var(--primary-glow)', color: 'var(--primary-color)', minWidth: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}>
              {companyName.charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <h3 
                style={{ 
                  color: 'var(--text-primary)', 
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  margin: 0,
                  fontSize: '0.95rem',
                  lineHeight: '1.2',
                  fontWeight: 600
                }} 
                title={companyName}
              >
                {companyName}
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Workspace</div>
            </div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <a 
            href={`/${params.slug}/dashboard`} 
            className={`nav-item ${pathname === `/${params.slug}/dashboard` ? 'active' : ''}`}
          >
            Dashboard
          </a>
          <a 
            href={`/${params.slug}/users`} 
            className={`nav-item ${pathname === `/${params.slug}/users` ? 'active' : ''}`}
          >
            Team Members
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="top-nav">
          <div>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Welcome back, {user.name}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative' }}>
            <div 
              style={{ background: 'var(--primary-color)', color: 'white', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', cursor: 'pointer' }}
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              title="Profile Options"
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            
            {showProfileMenu && (
              <div className="dropdown-menu">
                <a 
                  href={`/${params.slug}/settings`} 
                  className="dropdown-item"
                >
                  ⚙️ Settings
                </a>
              </div>
            )}
          </div>
        </header>
        
        <div className="page-content animate-fade-in">
          <UserProvider user={user}>
            {children}
          </UserProvider>
        </div>
      </main>
    </div>
  );
}
