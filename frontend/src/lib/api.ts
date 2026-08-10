export const API_URL = typeof window !== 'undefined' 
  ? `${window.location.protocol}//${window.location.hostname}:8000/api/v1` 
  : 'http://localhost:8000/api/v1';

export async function fetchApi(endpoint: string, options: RequestInit = {}, tenantSlug?: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (tenantSlug) {
    headers['X-Tenant-Slug'] = tenantSlug;
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.detail || data.message || 'An error occurred');
  }
  
  return data;
}
