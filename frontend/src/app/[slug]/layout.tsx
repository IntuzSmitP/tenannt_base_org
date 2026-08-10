"use client";

import { usePathname, useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';
import { UserProvider } from '@/app/context/UserContext';

interface UserProfile { name: string; role: string; [key: string]: unknown; }

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

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header" style={{ overflow: 'hidden' }}>
          <h3 
            style={{ 
              color: 'var(--text-primary)', 
              whiteSpace: 'nowrap', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis',
              margin: 0
            }} 
            title={slug}
          >
            {slug}
          </h3>
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
        <div style={{ padding: '1.5rem 1rem' }}>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%' }}>
            Log out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="top-nav">
          <div>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Welcome back, {user.name}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: 'var(--primary-color)', color: 'white', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              {user.name.charAt(0)}
            </div>
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
